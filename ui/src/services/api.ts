import { Contract, ContractAnalysis } from '../types';

// API基础URL - 实际应用中需要根据环境配置
const API_BASE_URL = 'http://localhost:8000/api';

// 上传合同文件并获取解析结果
export const uploadContractFile = async (file: File): Promise<{ contract: Contract, analysis: ContractAnalysis }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE_URL}/review`, {
      method: 'POST',
      body: formData,
      // 不设置Content-Type，让浏览器自动设置
    });
    
    if (!response.ok) {
      throw new Error(`上传失败: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('上传合同文件时出错:', error);
    throw error;
  }
};

// 获取所有合同列表
export const getContracts = async (): Promise<Contract[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/contracts`);
    
    if (!response.ok) {
      throw new Error(`获取合同列表失败: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取合同列表时出错:', error);
    throw error;
  }
};

// 获取特定合同的分析结果
export const getContractAnalysis = async (contractId: string): Promise<ContractAnalysis> => {
  try {
    const response = await fetch(`${API_BASE_URL}/contracts/${contractId}/analysis`);
    
    if (!response.ok) {
      throw new Error(`获取合同分析失败: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取合同分析时出错:', error);
    throw error;
  }
};
