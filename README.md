
# Gemini Flux: VS Code 集成与开发指南

欢迎使用 **Gemini Flux** 部署引擎。以下是将此项目集成到本地 VS Code 环境的步骤：

## 1. 本地环境搭建

1. **解压/创建文件夹**: 将所有项目文件存放在本地目录。
2. **安装 Node.js**: 确保你的系统已安装 Node.js (建议 v18.0.0 以上)。
3. **安装依赖**:
   在 VS Code 终端中运行：
   ```bash
   npm install
   ```
4. **配置 API Key**:
   在根目录创建 `.env` 文件：
   ```env
   VITE_API_KEY=你的_GEMINI_API_KEY
   ```

## 2. 启动开发
运行以下命令开启实时预览：
```bash
npm run dev
```

## 3. 市场定位
本项目属于 **AI 工程化中间件 (AI Middleware)** 市场。它将 Gemini 的原子能力（OCR、图像生成、代码生成）封装为可立即上线的业务模块，缩短了从 API 到产品的研发周期。

## 4. 推荐扩展
- **Tailwind CSS IntelliSense**: 用于快速调整仪表盘 UI 样式。
- **ESLint**: 保持工程代码质量。
- **Prettier**: 一键格式化代码。

## 5. 自动部署配置

本项目已配置自动部署到 Vercel，支持以下功能：

### CI/CD 流程
- ✅ **GitHub Actions CI**: 自动构建和测试
- ✅ **Vercel 部署**: 主分支自动部署到生产环境
- ✅ **预览部署**: PR 自动生成预览链接

### Vercel 部署设置

1. **连接 GitHub 仓库到 Vercel**:
   - 访问 [Vercel Dashboard](https://vercel.com)
   - 导入你的 GitHub 仓库
   - 项目会自动检测 Vite 框架

2. **配置环境变量**:
   在 Vercel 项目设置中添加:
   ```
   VITE_API_KEY=你的_GEMINI_API_KEY
   ```

3. **自动部署**:
   - 推送到 `main` 或 `master` 分支 → 自动部署到生产环境
   - 创建 Pull Request → 自动生成预览部署

### GitHub Secrets 配置（可选）

如果使用 GitHub Actions 部署工作流，需要在仓库设置中添加以下 Secrets：
- `VERCEL_TOKEN`: Vercel 访问令牌
- `VITE_API_KEY`: Gemini API 密钥

### 手动部署

如果需要手动部署到 Vercel：
```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

---
*Flux Compiler v3.1 - 赋能 AI 快速部署*
