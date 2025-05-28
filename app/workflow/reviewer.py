from typing import Any, List, Optional

from llama_index.core.bridge.pydantic import BaseModel, Field
from llama_index.core.llms import LLM, ChatMessage
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from llama_index.core.tools.types import BaseTool
from llama_index.core.workflow import (
    Context,
    Event,
    StopEvent,
    Workflow,
    step,
)

from prepocess.template_convert import InputEvent
from prompts.review import (
    contract_classify_prompt,
    contract_review_map,
    summary_issues_prompt,
    default_review_prompt,
)


class Issue(BaseModel):
    id: int = Field(
        description="The content id of content, which corresponds to the Content x before each paragraph(e.g., 1, 2, etc.).",
    )
    content: str = Field(description="The original contract content corresponding to the issue.")
    description: str = Field(description="Description of the issue")
    severity: str = Field(description="Severity of the issue, which can only be one of low, medium, or high.")
    recommendation: str = Field(description="Recommendation of the issue")


class ResultIssue(Issue):
    part_start_id: int = Field(description="The start part id of the part.")
    part_end_id: int = Field(description="The end part id of the part.")


class IssueList(BaseModel):
    issues: List[Issue] = Field(description="Issues of the contract")


class SummaryIssues(BaseModel):
    summary: str = Field(default="", description="Summary of the issues")
    riskLevel: str | None = Field(
        default=None, description="Risk level of the issues. It can only be one of low, medium, or high."
    )
    score: int | None = Field(default=None, description="Score of the issues, 0-100")


class ContractAnalysis(SummaryIssues):
    issues: List[ResultIssue] = Field(description="Issues of the contract")


class IssueEvent(Event):
    issue_list: IssueList = Field(description="Issues of the contract")


class StreamEvent(Event):
    name: str
    msg: str
    data: Any = Field(default=None, exclude=True)

    @property
    def message(self) -> str:
        return self.msg

    @message.setter
    def message(self, value: str) -> None:
        self.msg = value


class Part(BaseModel):
    title: str = Field(description="The title of the part")
    start_id: int = Field(
        description="The start content id of the part, which corresponds to the Content x before each paragraph(e.g., Content 1, Content 2, etc.)."
    )
    end_id: int = Field(
        description="The end content id of the part, which corresponds to the Content x before each paragraph(e.g., Content 1, Content 2, etc.)."
    )
    category: str = Field(description="The category of the part")


class ContractParts(BaseModel):
    parts: List[Part] = Field(description="The parts of the contract")


class ContractPartEvent(Event):
    part: Part = Field(description="The part of the contract")
    part_text: str = Field(description="The text of the current part")


class ReviewerAgent(Workflow):
    def __init__(
        self,
        *args: Any,
        llm: LLM | None = None,
        chat_history: Optional[List[ChatMessage]] = None,
        tools: List[BaseTool] | None = None,
        summary: bool = False,
        summary_issues_prompt: PromptTemplate = PromptTemplate(summary_issues_prompt),
        verbose: bool = False,
        timeout: float = 720.0,
        name: str = "Reviewer",
        description: str | None = None,
        **kwargs: Any,
    ) -> None:
        """
        ReviewerAgent is a workflow that reviews the contract and returns the issues.
        If summary is True, it will also summarize the issues.
        Args:
            llm: The LLM to use.
            chat_history: The chat history.
            tools: The tools to use.
            summary: Whether to summarize the issues.
            summary_issues_prompt: The prompt to use for summarizing the issues.
            verbose: Whether to print the verbose output.
            timeout: The timeout for the workflow.
            name: The name of the workflow.
            description: The description of the workflow.
            **kwargs: Additional arguments.
        """
        kwargs.update({"verbose": verbose, "timeout": timeout})
        super().__init__(*args, **kwargs)
        self.tools = tools or []
        self.name = name
        self.description = description

        self.llm = llm or Settings.llm
        self.summary = summary
        self.summary_issues_prompt = summary_issues_prompt

        self.memory = ChatMemoryBuffer.from_defaults(llm=self.llm, chat_history=chat_history)

    @step
    async def split_contract(self, cxt: Context, event: InputEvent) -> ContractPartEvent:
        """Split the contract and classify the parts"""
        contract_content = event.all_id_text
        contents = event.contents

        classify_result = await self.llm.apredict(
            PromptTemplate(contract_classify_prompt),
            contract_content=contract_content,
            schema=ContractParts.model_json_schema(),
        )
        parts = ContractParts.model_validate_json(classify_result)
        cxt.write_event_to_stream(StreamEvent(name=self.name, msg="Classify", data=parts.model_dump_json()))

        await cxt.set("event_num", len(parts.parts))
        for part in parts.parts:
            part_text = ""
            for content in contents[part.start_id : part.end_id + 1]:
                # Add content id to the header of the content
                part_text += f"Content {content.id}: {content.content}\n"
            cxt.send_event(
                ContractPartEvent(
                    part=part,
                    part_text=part_text
                )
            )

    @step(num_workers=6)
    async def review_contract(self, cxt: Context, event: ContractPartEvent) -> IssueEvent:
        """Review the contract and return the issues."""

        contract_part = event.part
        review_prompt = contract_review_map.get(contract_part.category, default_review_prompt)
        issues = await self.llm.apredict(
            PromptTemplate(review_prompt),
            contract_content=event.part_text,
            schema=IssueList.model_json_schema(mode="serialization"),
        )

        issues = IssueList.model_validate_json(issues)
        result_issues = []
        for issue in issues.issues:
            # add startPosition and endPosition to the issue
            result_issues.append(
                ResultIssue(
                    **issue.model_dump(),
                    part_start_id=event.part.start_id,
                    part_end_id=event.part.end_id,
                )
            )
        result_issues = IssueList(issues=result_issues)
        data = result_issues.model_dump()
        data["part_text"] = event.part_text
        cxt.write_event_to_stream(StreamEvent(name=self.name, msg="Reviewing", data=data))
        if self._verbose:
            print("Reviewing issue: ", issues.model_dump_json())
        return IssueEvent(issue_list=result_issues, part_text=event.part_text)

    @step
    async def summary_issues(self, cxt: Context, event: IssueEvent) -> StopEvent:
        """Summary the issues."""

        event_num = await cxt.get("event_num")
        results: List[IssueEvent] | None = cxt.collect_events(event, [IssueEvent] * event_num)
        # wait for all the contract parts to be reviewed
        if results is None:
            return None

        issues: List[ResultIssue] = []
        for result in results:
            issues.extend(result.issue_list.issues)
        issue_lst = IssueList(issues=issues)
        if self.summary:
            summary = await self.llm.apredict(
                self.summary_issues_prompt,
                issues=issue_lst.model_dump_json(exclude={"issues.startPosition", "issues.endPosition", "issues.id"}),
                schema=SummaryIssues.model_json_schema(),
            )
            summary = SummaryIssues.model_validate_json(summary)
            if self._verbose:
                print("Summary: ", summary.summary)
            cxt.write_event_to_stream(
                StreamEvent(name=self.name, msg="Summary", data=summary.model_dump_json(indent=4))
            )
            return StopEvent(
                result=ContractAnalysis(
                    issues=issues, summary=summary.summary, riskLevel=summary.riskLevel, score=summary.score
                )
            )
        else:
            return StopEvent(result=ContractAnalysis(issues=issues))
