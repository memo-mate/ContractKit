import React from 'react';
import { ContractAnalysis, ContractIssue } from '../types';

interface AnalysisPanelProps {
  analysis: ContractAnalysis;
  selectedIssue: string | null;
  onIssueSelect: (issueId: string) => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  selectedIssue,
  onIssueSelect,
}) => {
  // 生成风险等级标签
  const getRiskLabel = (riskLevel: string) => {
    return (
      <span className={`risk-label risk-${riskLevel}`}>
        {riskLevel === 'high' ? '高风险' : 
         riskLevel === 'medium' ? '中风险' : 
         riskLevel === 'low' ? '低风险' : '安全'}
      </span>
    );
  };

  // 生成风险分数展示
  const getScoreDisplay = (score: number) => {
    return (
      <div className="score-display">
        <div className="score-value">{score}</div>
        <div className="score-label">风险分数</div>
      </div>
    );
  };

  // 渲染每个问题的卡片
  const renderIssueCard = (issue: ContractIssue) => {
    const isSelected = selectedIssue === issue.id;
    
    // 根据风险等级选择图标
    const severityIcon = issue.severity === 'high' ? '⚠️' : 
                         issue.severity === 'medium' ? '⚠' : 'ℹ️';
    
    return (
      <div
        key={issue.id}
        className={`issue-card issue-${issue.severity} ${isSelected ? 'selected' : ''}`}
        onClick={() => onIssueSelect(issue.id)}
      >
        <div className="issue-header">
          <span className={`risk-label risk-${issue.severity}`}>
            {severityIcon} {issue.severity === 'high' ? '高风险' : 
                           issue.severity === 'medium' ? '中风险' : '低风险'}
          </span>
          <span className="issue-id">问题 #{issue.id.split('-')[1]}</span>
        </div>
        <div className="issue-content">
          <p className="issue-description">{issue.description}</p>
          <div className="issue-excerpt">
            <p className="issue-text">"{issue.content}"</p>
          </div>
          {issue.recommendation && (
            <div className="issue-recommendation">
              <p><strong>建议：</strong> {issue.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染分类的问题统计
  // const renderCategorySummary = () => {
  //   return (
  //     <div className="category-summary">
  //       <h3>问题分类</h3>
  //       <ul className="category-list">
  //         {Object.entries(analysis.categories).map(([category, data]) => (
  //           <li key={category} className="category-item">
  //             <span className="category-name">{category}</span>
  //             <div className="category-stats">
  //               <span className="category-count">{data.issues} 个问题</span>
  //               <span className="category-score">风险分数: {data.score}</span>
  //             </div>
  //           </li>
  //         ))}
  //       </ul>
  //     </div>
  //   );
  // };

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <h2>合同风险分析</h2>
        <div className="analysis-risk-score">
          {getRiskLabel(analysis.riskLevel)}
          {getScoreDisplay(analysis.score)}
        </div>
      </div>

      <div className="analysis-summary">
        <h3>总结</h3>
        <p>{analysis.summary}</p>
      </div>

      {/* {renderCategorySummary()} */}

      <div className="issues-container">
        <h3>发现的问题 ({analysis.issues.length})</h3>
        {analysis.issues.map(renderIssueCard)}
      </div>
    </div>
  );
};

export default AnalysisPanel;
