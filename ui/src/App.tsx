import React, { useState } from 'react';
import AnalysisPanel from './components/AnalysisPanel';
import ContractPanel from './components/ContractPanel';
import FileUploader from './components/FileUploader';
import { Contract, ContractAnalysis, ContractIssue } from './types';
import { uploadContractFile } from './services/api';
import { processAnalysisIssues } from './utils/analysis';
import './styles/index.css';

// 示例数据 - 实际应用中这些数据会从API获取
const sampleContract: Contract = {
  id: 'contract-001',
  name: '房屋租赁合同',
  content: `甲方（出租方）：张三
联系方式：13800138000
地址：北京市朝阳区某某路1号

乙方（承租方）：李四
联系方式：13900139000
地址：北京市海淀区某某路2号

根据《中华人民共和国合同法》等相关法律法规的规定，甲乙双方在平等、自愿、协商一致的基础上，就房屋租赁事宜达成如下协议：

第一条 房屋基本情况
1.1 房屋坐落于北京市朝阳区某某路1号，建筑面积为100平方米。
1.2 该房屋权属：甲方为该房屋的合法所有权人。
1.3 该房屋用途为居住。

第二条 租赁期限
2.1 租赁期限自2023年7月1日起至2025年6月30日止，共计24个月。
2.2 租赁期满，甲方有权收回房屋，乙方应如期交还。乙方如要求继续租赁，则须提前一个月向甲方提出，经甲方同意后，重新签订租赁合同。

第三条 租金及支付方式
3.1 月租金为人民币伍仟元整（¥5,000.00）。
3.2 支付方式：乙方应于每月1日前向甲方支付当月租金。
3.3 租金支付方式为银行转账，甲方指定账户如下：
    开户银行：某某银行
    账户名称：张三
    账号：6222 0000 0000 0000

第四条 保证金
4.1 乙方应在签订本合同时向甲方支付保证金人民币壹万元整（¥10,000.00）。
4.2 保证金用于担保乙方按时支付租金及履行本合同下的义务。
4.3 租赁期满且乙方无违约行为，甲方应在乙方返还房屋后的7日内全额退还保证金（不计利息）。

第五条 房屋维护及维修
5.1 在租赁期内，甲方应保证房屋的建筑结构和设备设施的安全。
5.2 乙方应合理使用并爱护房屋及其附属设施，不得擅自改变房屋结构和用途。
5.3 正常的房屋及设施设备维修由甲方负责；因乙方使用不当造成的损坏，修理费用由乙方承担。

第六条 违约责任
6.1 甲方未按约定提供房屋或房屋不符合约定条件，乙方有权解除合同并要求甲方双倍返还已付款项。
6.2 乙方逾期支付租金超过十日，甲方有权要求乙方按日支付应付租金的0.1%作为违约金。
6.3 乙方擅自将房屋转租给第三方，甲方有权解除合同并没收保证金。

第七条 合同解除
7.1 经甲乙双方协商一致，可以解除本合同。
7.2 因不可抗力因素导致合同无法继续履行的，本合同自行终止，甲乙双方互不承担违约责任。

第八条 甲乙双方约定的其他事项：
无

第九条 合同争议解决方式
本合同项下发生的争议，由甲乙双方协商解决；协商不成的，可向房屋所在地人民法院提起诉讼。

第十条 本合同自甲乙双方签字或盖章之日起生效。本合同一式两份，甲乙双方各执一份，具有同等法律效力。
<table>
    <thead>
        <tr>
            <th>序号</th>
            <th>名称</th>
            <th>品牌</th>
            <th>型号/规格</th>
            <th>数量</th>
            <th>原产地</th>
            <th>制造商名称</th>
            <th>单价</th>
            <th>价格</th>
            <th>备注</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>2</td>
            <td>智能门锁 (宾馆锁)</td>
            <td>得安</td>
            <td>TAS-T 系列</td>
            <td>2</td>
            <td>深圳</td>
            <td>套</td>
            <td><|单价，例如：800元|></td>
            <td><|总价，例如：1600元|></td>
            <td></td>
        </tr>
        <tr>
            <td>3</td>
            <td>金属按钮</td>
            <td>COUNS</td>
            <td>86</td>
            <td>30</td>
            <td>深圳</td>
            <td>个</td>
            <td><|单价，例如：20元|></td>
            <td><|总价，例如：600元|></td>
            <td></td>
        </tr>
    </tbody>
    <tfoot>
        <tr>
            <td colspan="8">总价</td>
            <td><|总计金额，例如：2700元|></td>
            <td></td>
        </tr>
    </tfoot>
</table>

甲方（签章）：                     乙方（签章）：
日期：                           日期：`,
  dateUploaded: '2023-06-15',
};

// 重新计算和验证每个问题的位置
const contractContent = sampleContract.content;

// 精确定位问题位置
const findTextPosition = (text: string): {start: number, end: number} => {
  const start = contractContent.indexOf(text);
  return { 
    start: start, 
    end: start + text.length 
  };
};

// 租期问题
const issue1Pos = findTextPosition('租赁期限自2023年7月1日起至2025年6月30日止');
// 保证金问题
const issue2Pos = findTextPosition('保证金人民币壹万元整（¥10,000.00）');
// 违约金问题
const issue3Pos = findTextPosition('乙方逾期支付租金超过十日，甲方有权要求乙方按日支付应付租金的0.1%作为违约金');
// 转租问题
const issue4Pos = findTextPosition('乙方擅自将房屋转租给第三方，甲方有权解除合同并没收保证金');
// 争议解决问题
const issue5Pos = findTextPosition('本合同项下发生的争议，由甲乙双方协商解决；协商不成的，可向房屋所在地人民法院提起诉讼');

const sampleIssues: ContractIssue[] = [
  {
    id: 'issue-001',
    startPosition: issue1Pos.start,
    endPosition: issue1Pos.end,
    content: '租赁期限自2023年7月1日起至2025年6月30日止',
    description: '合同期限过长，建议不超过12个月，以便灵活调整条款',
    severity: 'medium',
    recommendation: '建议修改为12个月租期，并添加优先续租条款'
  },
  {
    id: 'issue-002',
    startPosition: issue2Pos.start,
    endPosition: issue2Pos.end,
    content: '保证金人民币壹万元整（¥10,000.00）',
    description: '保证金金额过高，超过两个月租金，存在法律风险',
    severity: 'high',
    recommendation: '建议降低保证金金额，不超过两个月租金'
  },
  {
    id: 'issue-003',
    startPosition: issue3Pos.start,
    endPosition: issue3Pos.end,
    content: '乙方逾期支付租金超过十日，甲方有权要求乙方按日支付应付租金的0.1%作为违约金',
    description: '违约金比例设置不合理，可能被认定为无效条款',
    severity: 'high',
    recommendation: '建议将违约金调整为更合理的比例，如每日万分之三'
  },
  {
    id: 'issue-004',
    startPosition: issue4Pos.start,
    endPosition: issue4Pos.end,
    content: '乙方擅自将房屋转租给第三方，甲方有权解除合同并没收保证金',
    description: '直接没收全部保证金的条款过于严苛，可能被认定为无效',
    severity: 'medium',
    recommendation: '建议修改为"有权解除合同并要求赔偿实际损失"'
  },
  {
    id: 'issue-005',
    startPosition: issue5Pos.start,
    endPosition: issue5Pos.end,
    content: '本合同项下发生的争议，由甲乙双方协商解决；协商不成的，可向房屋所在地人民法院提起诉讼',
    description: '争议解决方式缺少仲裁选项，不利于快速解决纠纷',
    severity: 'low',
    recommendation: '建议增加仲裁选项，如"或提交至XX仲裁委员会仲裁"'
  }
];

const sampleAnalysis: ContractAnalysis = {
  issues: sampleIssues,
  summary: '本合同整体结构完整，但存在几处法律风险点，主要集中在保证金金额、违约责任条款及租期设置方面。建议对标记的高风险条款进行修改，以降低合同纠纷风险。',
  riskLevel: 'medium',
  score: 72
};

const App: React.FC = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setUploadError(null);
    
    try {
      const result = await uploadContractFile(file);
      setContract(result.contract);
      // 处理分析结果，添加缺失的位置信息
      const processedAnalysis = processAnalysisIssues(result.analysis, result.contract.content);
      setAnalysis(processedAnalysis);
      setSelectedIssue(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败，请稍后重试');
      console.error('文件上传失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理问题选择
  const handleIssueSelect = (issueId: string) => {
    setSelectedIssue(issueId === selectedIssue ? null : issueId);
  };

  // 如果没有上传合同或者正在加载，显示仅上传组件
  if (!contract || !analysis) {
    return (
      <div className="app-container upload-only">
        <div className="welcome-header">
          <h1>合同法律风险分析系统</h1>
          <p>上传Word文档格式的合同，系统将自动分析合同中的法律风险点并提供修改建议。</p>
        </div>
        <FileUploader 
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          error={uploadError}
        />
        {/* 添加示例数据按钮，方便测试 */}
        <button 
          className="load-sample-btn"
          onClick={() => {
            setContract(sampleContract);
            setAnalysis(sampleAnalysis);
          }}
        >
          加载示例数据
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="top-section">
        <FileUploader 
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          error={uploadError}
          isCompact={true}
        />
      </div>
      <div className="panels-container">
        <AnalysisPanel
          analysis={analysis}
          selectedIssue={selectedIssue}
          onIssueSelect={handleIssueSelect}
        />
        <ContractPanel
          contract={contract}
          issues={analysis.issues}
          selectedIssue={selectedIssue}
          onIssueSelect={handleIssueSelect}
        />
      </div>
    </div>
  );
};

export default App;
