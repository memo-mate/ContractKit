from typing import Any, List, Optional

from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.document import Document
from docx.oxml.xmlchemy import BaseOxmlElement
from llama_index.core.bridge.pydantic import Field
from llama_index.core.llms import LLM, ChatMessage
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)

from prompts.prompts import CONVERT_PROMPT, CONVERT_TABLE_PROMPT
from workflow.utils import Content, set_paragraph_text
from prepocess.html2word import html_table_to_word


class InputEvent(StartEvent):
    contents: List[Content] = Field(default_factory=list, description="The contents to fill")
    document: Document | None = Field(default=None, description="The document to fill", exclude=True)

    @property
    def all_text(self) -> str:
        return "\n".join([content.content for content in self.contents])
    
    @property
    def all_id_text(self) -> str:
        return "\n".join([f"Content {content.id}: {content.content}" for content in self.contents])


class StreamEvent(Event):
    data: str
    name: str
    msg: str


class TemplateConvertAgent(Workflow):
    def __init__(
        self,
        *args: Any,
        llm: LLM | None = None,
        chat_history: Optional[List[ChatMessage]] = None,
        system_prompt: PromptTemplate = PromptTemplate(CONVERT_PROMPT),
        convert_table_system_prompt: PromptTemplate = PromptTemplate(CONVERT_TABLE_PROMPT),
        verbose: bool = False,
        timeout: float = 360.0,
        name: str = "TemplateConvert",
        description: str | None = None,
        **kwargs: Any,
    ) -> None:
        kwargs.update({"verbose": verbose, "timeout": timeout})
        super().__init__(*args, **kwargs)
        self.name = name
        self.description = description

        self.llm = llm or Settings.llm

        self.system_prompt = system_prompt
        self.convert_table_system_prompt = convert_table_system_prompt

        self.memory = ChatMemoryBuffer.from_defaults(llm=self.llm, chat_history=chat_history)

    @step
    async def convert_template(self, cxt: Context, event: InputEvent) -> StopEvent:
        """Convert to standard contract template"""

        contents = event.contents
        all_text = event.all_text
        doc = event.document
        for content in contents:
            if content.content.strip() in ["", "\n"]:
                continue

            if isinstance(content.raw, Paragraph):
                tokgen = await self.llm.apredict(
                    prompt=self.system_prompt,
                    template_content=all_text,
                    current_content=content.content,
                )
                # if tokgen in ["null", "None", "null\n", "None\n"]:
                #     continue
                if "null" in tokgen:
                    continue
                set_paragraph_text(content.paragraphs[0], tokgen)
                cxt.write_event_to_stream(StreamEvent(name=self.name, msg="Converting paragraph", data=tokgen))

            elif isinstance(content.raw, Table):
                tokgen = await self.llm.apredict(
                    prompt=self.convert_table_system_prompt,
                    template_content=all_text,
                    html_table=content.content,
                )
                if tokgen in ["null", "None", "null\n", "None\n"]:
                    continue
                new_table = html_table_to_word(tokgen, doc)
                if new_table is None:
                    continue
                tb = content.raw
                
                previous_element: BaseOxmlElement = tb._element.getprevious()
                if previous_element is None:
                    raise
                tb._element.getparent().remove(tb._element)
                previous_element.addnext(new_table._tbl)

                cxt.write_event_to_stream(
                    StreamEvent(name=self.name, msg="Converting table", data=tokgen)
                )

        return StopEvent()
