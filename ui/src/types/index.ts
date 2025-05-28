// 合同问题类型
export interface ContractIssue {
  id: string;
  startPosition: number;
  endPosition: number;
  content: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
}

// 合同分析结果类型
export interface ContractAnalysis {
  issues: ContractIssue[];
  summary: string;
  riskLevel: 'high' | 'medium' | 'low' | 'safe';
  score: number;
  categories?: {
    [key: string]: {
      issues: number;
      score: number;
    };
  };
}

// 合同文本类型
export interface Contract {
  id: string;
  name: string;
  content: string;
  dateUploaded: string;
}
