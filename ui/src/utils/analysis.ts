import { ContractAnalysis, ContractIssue } from '../types';

/**
 * 为分析结果中的每个 issue 添加缺失的 startPosition 和 endPosition 字段
 * @param analysis 原始分析结果
 * @param contractContent 合同内容
 * @returns 处理后的分析结果
 */
export const processAnalysisIssues = (
  analysis: ContractAnalysis,
  contractContent: string
): ContractAnalysis => {
  const processedIssues = analysis.issues.map((issue, index) => {
    // 如果已经存在位置信息，直接返回
    if (issue.startPosition !== undefined && issue.endPosition !== undefined) {
      return issue;
    }

    // 在合同内容中查找问题内容的位置
    const content = issue.content;
    // 去除前后序号例如：8.1  ，8.7 
    const contentWithoutNumber = content.replace(/^\d+\.\d+\s*/, '');
    const startPos = contractContent.indexOf(contentWithoutNumber);
    
    // 如果找不到内容，使用默认值
    if (startPos === -1) {
      console.warn(`无法在合同内容中找到问题 ${index + 1} 的内容: ${content}`);
      return {
        ...issue,
        startPosition: 0,
        endPosition: 0,
      };
    }

    return {
      ...issue,
      startPosition: startPos,
      endPosition: startPos + content.length,
    };
  });

  return {
    ...analysis,
    issues: processedIssues,
  };
}; 