import React, { useEffect, useRef } from "react";
import { Contract, ContractIssue } from "../types";

// 扩展全局Window接口
declare global {
  interface Window {
    highlightIssue: (issueId: string) => void;
  }
}

interface ContractPanelProps {
  contract: Contract;
  issues: ContractIssue[];
  selectedIssue: string | null;
  onIssueSelect: (issueId: string) => void;
}

const ContractPanel: React.FC<ContractPanelProps> = ({
  contract,
  issues,
  selectedIssue,
  onIssueSelect,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 解析HTML表格，并在表格中对问题进行高亮
  const parseTable = (
    tableHtml: string,
    position: number,
    validIssues: ContractIssue[],
  ): JSX.Element => {
    // 创建临时DOM元素解析表格
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = tableHtml;
    const table = tempDiv.querySelector("table");

    if (!table) {
      return <div dangerouslySetInnerHTML={{ __html: tableHtml }} />;
    }

    // 获取表格所有单元格内容
    const cells: HTMLTableCellElement[] = Array.from(
      table.querySelectorAll("th, td"),
    );

    // 存储所有单元格的起始位置
    const cellPositions: {
      element: HTMLTableCellElement;
      start: number;
      end: number;
    }[] = [];

    // 计算每个单元格在原始文本中的位置
    let currentPos = position;
    const tableOpenTagLength = tableHtml.indexOf(">") + 1;
    currentPos += tableOpenTagLength;

    cells.forEach((cell) => {
      // 获取整个单元格的HTML（包括标签）
      const cellHtml = cell.outerHTML;
      const cellContent = cell.innerHTML;

      // 定位单元格内容在表格HTML中的位置
      const cellStart = tableHtml.indexOf(cellHtml, currentPos - position);
      if (cellStart !== -1) {
        // 计算单元格内容的开始和结束位置
        const contentStart = cellStart + cellHtml.indexOf(">") + 1 + position;
        const contentEnd = contentStart + cellContent.length;

        cellPositions.push({
          element: cell,
          start: contentStart,
          end: contentEnd,
        });

        // 更新位置
        currentPos = contentEnd;
      }
    });

    // 处理每个单元格，检查是否有问题需要高亮
    cellPositions.forEach((cellPos) => {
      const { element, start, end } = cellPos;

      // 查找与此单元格重叠的问题
      const cellIssues = validIssues.filter(
        (issue) => issue.startPosition < end && issue.endPosition > start,
      );

      if (cellIssues.length > 0) {
        // 如果有问题需要高亮，处理单元格内容
        let cellContent = element.innerHTML;
        let lastEnd = 0;
        const parts: string[] = [];

        // 排序问题（按在单元格中的位置）
        const sortedCellIssues = [...cellIssues].sort(
          (a, b) =>
            Math.max(a.startPosition, start) - Math.max(b.startPosition, start),
        );

        sortedCellIssues.forEach((issue) => {
          // 计算问题在单元格内的相对位置
          const issueStart = Math.max(issue.startPosition, start) - start;
          const issueEnd = Math.min(issue.endPosition, end) - start;

          // 添加问题前的文本
          if (issueStart > lastEnd) {
            parts.push(cellContent.substring(lastEnd, issueStart));
          }

          // 添加高亮的问题文本
          const isSelected = selectedIssue === issue.id;
          const highlightClass = `highlight-${issue.severity} ${isSelected ? "selected" : ""}`;
          const highlightHtml = `<span class="${highlightClass}" 
                                      data-issue-id="${issue.id}"
                                      onclick="window.highlightIssue('${issue.id}')">
                                  ${cellContent.substring(issueStart, issueEnd)}
                                </span>`;
          parts.push(highlightHtml);

          lastEnd = issueEnd;
        });

        // 添加最后一部分文本
        if (lastEnd < cellContent.length) {
          parts.push(cellContent.substring(lastEnd));
        }

        // 更新单元格内容
        element.innerHTML = parts.join("");
      }
    });

    return (
      <div
        className="contract-table"
        dangerouslySetInnerHTML={{ __html: table.outerHTML }}
      />
    );
  };

  // 注册点击高亮文本的全局处理函数
  useEffect(() => {
    // 将高亮点击处理函数添加到window对象
    window.highlightIssue = (issueId: string) => {
      onIssueSelect(issueId);
    };

    // 清理函数
    return () => {
      delete (window as any).highlightIssue;
    };
  }, [onIssueSelect]);

  // 高亮合同中的问题文本
  const renderHighlightedContent = () => {
    if (!contract.content) return <p>无合同内容</p>;

    // 问题排序(按照在文本中出现的顺序)
    const sortedIssues = [...issues].sort(
      (a, b) => a.startPosition - b.startPosition,
    );

    // 检查是否有重叠的问题区域
    let validIssues: ContractIssue[] = [];
    let lastEnd = -1;

    for (const issue of sortedIssues) {
      // 确保起始位置和结束位置有效
      if (
        issue.startPosition >= 0 &&
        issue.endPosition > issue.startPosition &&
        issue.startPosition < contract.content.length
      ) {
        // 如果当前问题的起始位置在上一个问题的结束位置之后，则添加它
        if (issue.startPosition >= lastEnd) {
          validIssues.push(issue);
          lastEnd = issue.endPosition;
        }
      }
    }

    // 创建高亮后的内容片段
    const parts: JSX.Element[] = [];
    lastEnd = 0;

    // 检查内容是否包含HTML表格
    const containsHtmlTable = contract.content.includes("<table");

    if (containsHtmlTable) {
      // 如果包含HTML表格，需要特殊处理
      // 将合同内容分为非表格部分和表格部分
      const splitContent = contract.content.split(/(<table[\s\S]*?<\/table>)/);

      let position = 0;
      splitContent.forEach((part, splitIndex) => {
        const isTable = part.startsWith("<table");
        const partLength = part.length;
        const partEnd = position + partLength;

        // 对当前部分寻找相关的问题
        const partIssues = validIssues.filter(
          (issue) =>
            issue.startPosition < partEnd && issue.endPosition > position,
        );

        if (isTable) {
          // 表格部分使用特殊处理，解析表格并高亮其中的问题
          parts.push(
            <React.Fragment key={`table-${splitIndex}`}>
              {parseTable(part, position, partIssues)}
            </React.Fragment>,
          );
        } else {
          // 非表格部分，处理高亮
          let lastIssueEnd = position;

          partIssues.forEach((issue) => {
            // 调整问题的边界以适应当前部分
            const issueStart = Math.max(issue.startPosition, position);
            const issueEnd = Math.min(issue.endPosition, partEnd);

            // 添加问题前的文本
            if (issueStart > lastIssueEnd) {
              parts.push(
                <span key={`text-${splitIndex}-${issue.id}-before`}>
                  {part.substring(
                    lastIssueEnd - position,
                    issueStart - position,
                  )}
                </span>,
              );
            }

            // 添加高亮的问题文本
            const isSelected = selectedIssue === issue.id;
            parts.push(
              <span
                key={`highlight-${issue.id}`}
                className={`highlight-${issue.severity} ${isSelected ? "selected" : ""}`}
                onClick={() => onIssueSelect(issue.id)}
                data-issue-id={issue.id}
              >
                {part.substring(issueStart - position, issueEnd - position)}
              </span>,
            );

            lastIssueEnd = issueEnd;
          });

          // 添加最后一部分文本
          if (lastIssueEnd < partEnd) {
            parts.push(
              <span key={`text-${splitIndex}-last`}>
                {part.substring(lastIssueEnd - position, partLength)}
              </span>,
            );
          }
        }

        position += partLength;
      });
    } else {
      // 原来的纯文本处理逻辑
      validIssues.forEach((issue, index) => {
        // 添加问题前的文本
        if (issue.startPosition > lastEnd) {
          parts.push(
            <span key={`text-${index}`}>
              {contract.content.substring(lastEnd, issue.startPosition)}
            </span>,
          );
        }

        // 添加高亮的问题文本
        const isSelected = selectedIssue === issue.id;
        parts.push(
          <span
            key={`highlight-${issue.id}`}
            className={`highlight-${issue.severity} ${isSelected ? "selected" : ""}`}
            onClick={() => onIssueSelect(issue.id)}
            data-issue-id={issue.id}
          >
            {contract.content.substring(issue.startPosition, issue.endPosition)}
          </span>,
        );

        lastEnd = issue.endPosition;
      });

      // 添加最后一部分文本
      if (lastEnd < contract.content.length) {
        parts.push(
          <span key="text-last">{contract.content.substring(lastEnd)}</span>,
        );
      }
    }

    return <div className="contract-content">{parts}</div>;
  };

  // 当选中问题变化时，滚动到对应的高亮位置
  useEffect(() => {
    if (selectedIssue && contentRef.current) {
      const highlightElement = contentRef.current.querySelector(
        `[data-issue-id="${selectedIssue}"]`,
      );

      if (highlightElement) {
        highlightElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [selectedIssue]);

  // 开发调试用，输出问题区域
  useEffect(() => {
    console.log(
      "问题列表:",
      issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        start: issue.startPosition,
        end: issue.endPosition,
        content: issue.content,
      })),
    );
  }, [issues]);

  return (
    <div className="contract-panel">
      <div className="contract-header">
        <h2>{contract.name}</h2>
        <div className="contract-meta">
          <span>
            上传日期: {new Date(contract.dateUploaded).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="contract-document" ref={contentRef}>
        {renderHighlightedContent()}
      </div>
    </div>
  );
};

export default ContractPanel;
