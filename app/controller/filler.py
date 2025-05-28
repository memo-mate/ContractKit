import os
import tempfile

from docx.document import Document as DocxDocument
from llama_index.core.llms import LLM, ChatMessage
from llama_index.core.workflow.handler import WorkflowHandler

from prompts.prompts import handle_incomplete_prompt
from workflow.filling import FillingAgent, InputEvent
from workflow.utils import Content, get_contents


class ContractFiller:
    def __init__(self, llm: LLM):
        self.document_path: str | None = None
        self.chat_history: list[ChatMessage] = []
        self.filling: FillingAgent | None = None
        self.handler: WorkflowHandler | None = None
        self.temp_file: str | None = None
        self.llm = llm

    @staticmethod
    def _get_placeholder_text(contents: list[Content]) -> str:
        texts = []
        for content in contents:
            if "<|" in content.content and "|>" in content.content:
                texts.append(content.content)
        return "\n".join(texts)

    async def initialize(self, template_path: str):
        contents, doc = get_contents(template_path)
        self.document_path = template_path
        document_text = self._get_placeholder_text(contents)
        self.START_MSG = await self.llm.apredict(handle_incomplete_prompt, written=document_text)
        self.chat_history = [
            ChatMessage(role="assistant", content=self.START_MSG),
        ]

        self.filling = FillingAgent(
            llm=self.llm,
            chat_history=self.chat_history,
            verbose=True,
            timeout=360,
            name="合同填写助手",
            write_events=True,
            description="合同自动填写系统",
        )

        return self.START_MSG

    async def process_message(self, user_input: str) -> tuple[str, str]:
        if not self.document_path or not self.filling:
            return "请先选择合同模板", ""

        self.chat_history.append(ChatMessage(role="user", content=user_input))

        # if self.handler:
        #     await self.handler

        self.handler = self.filling.run(start_event=InputEvent(document_path=self.document_path))

        ret = await self.handler
        self.chat_history.append(ChatMessage(role="assistant", content=str(ret)))
        if self.temp_file and os.path.exists(self.temp_file):
            os.unlink(self.temp_file)
        document: DocxDocument = ret["document"]
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp_file:
            document.save(tmp_file.name)
            self.temp_file = tmp_file.name
        self.document_path = self.temp_file

        return ret["response"], self.temp_file
