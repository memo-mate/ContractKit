# 合同智能审核系统 - 前端界面

这是一个基于React和TypeScript开发的合同智能审核系统前端界面。该系统可以自动分析合同内容，识别潜在的法律风险点，并在界面上直观地展示这些风险点。

## 功能特点

- 左右分栏布局，左侧显示分析结果，右侧显示合同内容
- 在合同文本中高亮显示风险点
- 点击分析结果中的问题可跳转到对应的合同内容位置
- 根据风险程度不同，使用不同颜色进行标识
- 提供问题详情和改进建议

## 启动方法

1. 安装依赖：
```
npm install
```

2. 启动开发服务器：
```
npm start
```

3. 构建生产版本：
```
npm run build
```

## 技术栈

- React 18
- TypeScript
- Material-UI
- CSS3

## 项目结构

```
ui/
├── public/              # 静态资源
├── src/                 # 源代码
│   ├── components/      # React组件
│   ├── styles/          # CSS样式
│   ├── types/           # TypeScript类型定义
│   ├── App.tsx          # 主应用组件
│   └── index.tsx        # 应用入口
├── package.json         # 项目配置和依赖
└── tsconfig.json        # TypeScript配置
``` 