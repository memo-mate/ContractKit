from typing import Any, Literal

from docx.shared import RGBColor
from llama_index.core.llms import LLM

from workflow.reviewer import ContractAnalysis, ReviewerAgent, InputEvent
from workflow.utils import Content, get_contents


class ReviewController:
    def __init__(
        self,
        llm: LLM | None = None,
        summary: bool = False,
        author: str = "XiaoXi Reviewer",
        initials: str = "XR",
        **kwargs: Any,
    ) -> None:
        self.author = author
        self.initials = initials

        self.reviewer = ReviewerAgent(llm=llm, summary=summary, **kwargs)

    async def review(self, document_path: str, save_path: str, font_color: bool = True) -> ContractAnalysis:
        """
        Review the document and save the result to the save_path.

        Args:
            document_path: The path to the document to review.
            save_path: The path to save the reviewed document.
            font_color: Whether to set the font color to the severity color.
        Returns:
            The contract analysis result.
        """
        contents, document = get_contents(document_path)

        ret: ContractAnalysis = await self.reviewer.run(start_event=InputEvent(contents=contents))

        for issue in ret.issues:
            content_id = issue.id

            cur_content = contents[content_id]
            comment = f"{issue.description}\n\nRecommendation: {issue.recommendation}"
            self.add_comment(cur_content, comment, severity=issue.severity, font_color=font_color)

        document.save(save_path)
        return ret

    def add_comment(
        self,
        content: Content,
        comment: str,
        *,
        severity: Literal["low", "medium", "high"] = "medium",
        font_color: bool = True,
    ) -> None:
        """
        Add comment to the content.

        Args:
            content: The content to add comment to.
            severity: The severity of the issue.
            comment: The comment to add.
            font_color: Whether to set the font color to the severity color.
        Returns:
            None
        """
        match severity:
            case "low":
                color = RGBColor(0, 0, 255)  # 淡蓝色
            case "medium":
                color = RGBColor(255, 255, 0)  # 淡黄色
            case "high":
                color = RGBColor(255, 0, 0)  # 红色
            case _:
                color = RGBColor(255, 255, 0)
        flag = True
        for paragraph in content.paragraphs:
            if flag:
                paragraph.add_comment(comment, author=self.author, initials=self.initials)
                flag = False
            if font_color:
                for run in paragraph.runs:
                    run.font.color.rgb = color
