# Agent Diplomacy

`Agent Diplomacy` 是一个基于 `React + Vite` 前端和 `FastAPI` 后端的多智能体外交策略模拟项目。当前仓库已经改为“本地启动即可游玩”的模式，不再依赖登录、OIDC、管理员初始化等额外链路。

## 项目结构

```text
app/
  backend/   FastAPI 后端
  frontend/  React + Vite 前端
```

## 核心功能

- 十个架空国家在同一张战略地图上进行博弈
- 每个国家由独立智能体负责军事决策与外交发信
- 支持阶段推进、公开战报、外交密信、历史记录、国家设置
- 后端真实调用兼容 OpenAI SDK 的模型接口生成各国行动
- 前端提供战略地图、游戏控制台、外交信箱、历史与数据页面

## 游戏机制

### 1. 基础设定

- 地图由陆地、省份、海域和补给中心组成
- 不同国家拥有各自初始领土、单位和行为倾向
- 单位主要分为 `Army` 和 `Fleet`，移动范围不同

### 2. 年度治理循环

游戏按年份、季节和阶段推进。每次点击推进，后端都会基于当前局势重新组织信息，并驱动各国智能体完成当阶段决策。

典型流程可以理解为：

1. 谈判与决策
2. 行动结算
3. 撤退或调整
4. 进入下一阶段或下一年度

### 3. 智能体决策

每个国家智能体都可以配置：

- `System Prompt`
- `Skills`
- `Memory`
- `Yearly Advice`
- 性格参数，例如进攻性、忠诚度、欺骗倾向

后端会把当前地图、单位位置、可执行行动、国家信息等整理成提示词，再交给模型生成：

- 军事命令
- 外交消息

系统会校验命令是否合法，并将结果结算回地图状态。

### 4. 信息系统

- 外交通信：国家之间可发送结盟、试探、威慑、求和等消息
- 公开战报：每个阶段结束后生成摘要，方便快速了解局势变化
- 历史记录：保留历次阶段结果，便于回看
- 国家设置：可调整各国智能体的长期策略参数

### 5. 扩张与胜负

- 国家通过争夺更多补给中心提升实力
- 补给中心数量会影响排行榜和整体局势判断
- 对局会随着年份推进持续演化，直到达到结束条件或由玩家手动重开

## 本地运行

仓库中保留了本地运行用的 `.env` 文件，但它们被 `.gitignore` 忽略，不会参与 Git 提交。你本地直接运行即可，不需要登录配置。

### 1. 启动后端

进入 `app/backend`：

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

默认地址：

```text
http://127.0.0.1:8000
```

后端主要环境变量：

- `DATABASE_URL`
- `APP_AI_KEY`
- `APP_AI_BASE_URL`

如需重新创建配置，可参考：

```text
app/backend/.env.example
```

### 2. 启动前端

进入 `app/frontend`：

```powershell
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:3000
```

前端默认请求本地后端：

```text
http://127.0.0.1:8000
```

如需重建前端配置，可参考：

```text
app/frontend/.env.example
```

## 构建

前端构建：

```powershell
cd app/frontend
npm run build
```

后端可使用常规 ASGI 方式运行：

```powershell
cd app/backend
.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

`app/backend/lambda_handler.py` 仅用于兼容旧部署入口，本地游玩不需要它。


