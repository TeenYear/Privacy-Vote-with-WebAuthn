# Privacy Vote — 基于零知识证明的匿名投票系统

> [English version](./README.md)

Privacy Vote 将 **WebAuthn 无密码认证**、**Noir 零知识电路** 和 **Solidity 智能合约** 三者结合，实现了一套"已认证但匿名"的投票流程：
投票方可证明自己是经过 KYC 审核的合法用户，却不会向任何人泄露"是谁投了哪一票"。

---

## 目录

- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [系统架构](#系统架构)
- [完整工作流程](#完整工作流程)
- [环境准备](#环境准备)
- [快速启动](#快速启动)
- [配置说明](#配置说明)
- [使用指南](#使用指南)
- [零知识电路详解](#零知识电路详解)
- [智能合约详解](#智能合约详解)
- [开发与调试](#开发与调试)
- [隐私保护机制](#隐私保护机制)
- [常见问题](#常见问题)
- [相关资源](#相关资源)

---

## 核心特性

| 特性                        | 说明                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| **零知识证明**        | 使用 Noir 编写 PLONK 电路，用户可证明自身合法性而无需暴露身份       |
| **WebAuthn 认证**     | 通过指纹、Face ID 或硬件安全密钥完成无密码注册和登录                |
| **确定性钱包**        | 由 WebAuthn 签名派生出以太坊钱包，保证同一用户始终对应同一地址      |
| **Merkle 树成员证明** | 32 层增量二叉 Merkle 树管理已认证用户集合，支持约 43 亿用户         |
| **Nullifier 防重投**  | 每位用户对每个提案只能投一票，由 Poseidon 哈希生成的 nullifier 保证 |
| **链上验证**          | PLONK 验证合约由 Noir 自动生成并部署在链上，投票结果不可篡改        |
| **地址自动同步**      | 部署合约后自动将新地址写入前后端配置文件，避免人工抄写出错          |

---

## 技术栈

| 层级     | 技术                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 前端     | React 18 · TypeScript · Chakra UI · Framer Motion · Web3Modal / ethers.js v6 |
| ZK 证明  | Noir · @noir-lang/noir_js · @noir-lang/backend_barretenberg (WASM)             |
| 认证     | WebAuthn (@passwordless-id/webauthn)                                             |
| 哈希     | poseidon-lite (BN254 友好哈希)                                                   |
| 后端     | Node.js · Express · ethers.js v6 · ts-node                                    |
| 智能合约 | Solidity 0.8.24 · Foundry (forge / anvil / cast)                                |
| 包管理   | pnpm workspace (monorepo)                                                        |

---

## 项目结构

```
privacy-vote/
├── package.json                   # 根配置，包含一键启动/部署脚本
├── pnpm-workspace.yaml            # pnpm monorepo 声明
├── scripts/
│   └── sync-contract-address.cjs  # 部署后自动同步合约地址到前后端
│
├── packages/
│   ├── client/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── connectButton.tsx   # 钱包连接 & 网络选择
│   │   │   │   ├── mainForm.tsx        # 注册 / 登录 / KYC 请求
│   │   │   │   └── voteForm.tsx        # 投票界面 & 证明生成
│   │   │   ├── utils/
│   │   │   │   ├── webAuthn.ts         # WebAuthn + ZK 证明核心逻辑
│   │   │   │   ├── getCircuit.ts       # 加载预编译 Noir 电路
│   │   │   │   └── utils.ts            # 辅助函数
│   │   │   ├── config.ts              # 集中化地址 & API 配置
│   │   │   ├── abi/ZK_KYC.json        # 合约 ABI
│   │   │   ├── circuit/
│   │   │   │   ├── src/main.nr        # Noir 电路源码（与 zkp 同源）
│   │   │   │   └── target/vote.json   # 预编译电路产物
│   │   │   └── App.tsx                # 应用入口组件
│   │   └── .env.local                 # 前端环境变量（自动生成）
│   │
│   ├── server/                    # Express 后端
│   │   ├── src/
│   │   │   ├── index.ts               # 服务器入口，挂载路由
│   │   │   ├── post/
│   │   │   │   ├── requestKYC_Route.ts    # POST /request-kyc
│   │   │   │   └── submitVoteRoute.ts     # POST /vote
│   │   │   ├── get/
│   │   │   │   ├── statusRoute.ts         # GET /status
│   │   │   │   ├── resultsRoute.ts        # GET /results
│   │   │   │   └── merkleProofRoute.ts    # GET /merkle-proof/:leafIndex
│   │   │   └── abi/ZK_KYC.json
│   │   └── .env                       # 后端环境变量
│   │
│   └── zkp/                       # Solidity 合约 + Noir 电路
│       ├── src/
│       │   ├── ZK_KYC.sol             # 主合约：用户 / 提案 / 投票
│       │   ├── CryptoTools.sol        # Merkle 树操作 & 证明生成
│       │   └── libraries/
│       │       ├── plonk_vk.sol       # Noir 生成的 PLONK 验证合约
│       │       ├── PoseidonT2.sol     # Poseidon 哈希 (1 输入)
│       │       ├── PoseidonT3.sol     # Poseidon 哈希 (2 输入)
│       │       ├── InternalBinaryIMT.sol  # 增量二叉 Merkle 树
│       │       └── Constants.sol      # BN254 常量 & 树深度
│       ├── circuits/
│       │   ├── src/main.nr            # Noir 电路源码
│       │   └── target/vote.json       # 编译产物
│       ├── script/
│       │   ├── Deploy.s.sol           # 部署 ZK_KYC + UltraVerifier
│       │   ├── BatchRegister.s.sol    # 批量注册测试用户
│       │   ├── SubmitProposal.s.sol   # 创建示例提案
│       │   ├── ScriptConfig.s.sol     # 脚本基类，读取缓存地址
│       │   ├── RequestRegister.s.sol  # 单用户注册请求
│       │   ├── AuthenticateUser.s.sol # 管理员审批用户
│       │   └── GetValue.s.sol         # 查询提案数据
│       ├── test/
│       │   ├── zkKYC.t.sol            # 用户注册测试
│       │   └── zkVote.t.sol           # 投票 ZK 验证测试
│       ├── cache/
│       │   └── zk_kyc_address.txt     # 部署后自动写入的合约地址
│       └── foundry.toml               # Foundry 编译配置
```

---

## 系统架构

```
┌─────────────────── 前端 (React, port 3000) ───────────────────┐
│                                                               │
│  WebAuthn 注册/登录  →  派生 Wallet  →  计算 Commitment        │
│                                                               │
│  GET /results 获取候选人列表                                   │
│  GET /merkle-proof/:leafIndex 获取 Merkle 证明                 │
│  Noir WASM 在本地生成 ZK 证明（缓存后端实例以加速）             │
│                                                               │
└──────┬──────────────┬──────────────┬──────────────────────────┘
       │ POST         │ GET          │ POST /vote
       │ /request-kyc │ /results     │
       │              │ /merkle-proof│
       ▼              ▼              ▼
┌─────────────────── 后端 (Express, port 4000) ─────────────────┐
│                                                                │
│  GET  /status              → 服务器状态 & 合约地址             │
│  GET  /results             → 所有候选人投票结果                │
│  GET  /merkle-proof/:idx   → 代理读取合约 Merkle 证明          │
│  POST /request-kyc         → 管理员调用 registerMultipleUsers()│
│  POST /vote                → 管理员调用 vote(proof, inputs)    │
│                                                                │
└──────┬──────────────────────────────────┬──────────────────────┘
       │                                 │
       ▼                                 ▼
┌─────────────────── 智能合约 (Anvil, port 8545) ───────────────┐
│                                                                │
│  ZK_KYC.sol         ←→  CryptoTools.sol (Merkle 树)           │
│  UltraVerifier.sol  ←   PLONK 链上验证                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 完整工作流程

### 1. 用户注册 & KYC

```
浏览器                           服务器                    智能合约
  │                               │                        │
  │── WebAuthn 创建凭证 ─────────→ │                        │
  │   （指纹/Face ID/安全密钥）     │                        │
  │                               │                        │
  │── WebAuthn 认证签名 ─────────→ │                        │
  │   派生确定性 Wallet            │                         │
  │   计算 commitment =            │                        │
  │   Poseidon2([secret, nulifier])│                        │
  │                                │                        │
  │── POST /request-kyc ─────────→ │                        │
  │   { username, userAddress,     │                        │
  │     commitmentHash }           │                        │
  │                                │── registerMultipleUsers() ──→ │
  │                                │   (管理员操作)         │
  │                                │                        │── 插入 Merkle 叶
  │                                │                        │── 发出 UsersRegistered 事件
  │                                │←── leafIndex ──────────│
  │←── { success, leafIndices } ───│                        │
  │                                │                        │
  │ 存储到 localStorage:           │                        │
  │   secret, nulifier, leafIndex  │                        │
```

### 2. 零知识投票

```
浏览器                           服务器                    智能合约
  │                                │                        │
  │── GET /results ──────────────→ │                        │
  │←── 20 个候选人列表 ────────────│                        │
  │                                │                        │
  │   用户选择 1 名候选人           │                        │
  │                                │                        │
  │── GET /merkle-proof/:idx ────→ │                        │
  │                                │── createProof(idx) ───→ │
  │                                │←── siblings + indices ──│
  │←── proofSiblings + pathIndices │                        │
  │                                │                        │
  │── 计算 nullifierHash =         │                        │
  │   Poseidon2([nulifier, proposalId])                     │
  │                                │                        │
  │── Noir WASM 生成 PLONK 证明    │                        │
  │   公开输入: root, nullifierHash, proposalId, voteType=1 │
  │   私有输入: nulifier, secret, siblings, pathIndices     │
  │                                │                        │
  │── POST /vote ────────────────→ │                        │
  │   { proofBytes, publicInputs } │                        │
  │                                │── vote(proof, inputs) ──→ │
  │                                │                        │── UltraVerifier.verify()
  │                                │                        │── 检查 nullifier 未使用
  │                                │                        │── 检查 root 有效
  │                                │                        │── 计票 (votesFor++)
  │                                │                        │── 发出 ProposalVoted 事件
  │                                │←── tx receipt ─────────│
  │←── { success } ────────────────│                        │
```

---

## 环境准备

### 必需工具

| 工具                 | 版本要求                   | 用途                      |
| -------------------- | -------------------------- | ------------------------- |
| **Node.js**    | >= 18                      | 运行前后端                |
| **pnpm**       | >= 8                       | Monorepo 包管理           |
| **Foundry**    | 最新稳定版                 | Solidity 编译、测试、部署 |
| **浏览器**     | 支持 WebAuthn 的现代浏览器 | 前端交互                  |
| **以太坊钱包** | MetaMask 等                | 连接 Web3Modal            |

### 安装 Foundry

**macOS / Linux：**

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**Windows：**

```bash
# 在 Git Bash 中执行，不要在 PowerShell/CMD 中执行
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

安装完成后，`forge`、`anvil`、`cast` 三个命令都应可用。

### Windows 用户注意

- 请使用 `pnpm.cmd` 代替 `pnpm`（PowerShell 执行策略可能限制 `.ps1` 脚本）
- 项目已集成 `cross-env` 处理跨平台环境变量兼容性
- Foundry 二进制文件默认安装在 `~/.foundry/bin/`，需确保该路径已加入 PATH

---

## 快速启动

### 1. 克隆并安装依赖

```bash
git clone <仓库地址>
cd privacy-vote
pnpm install
```

### 2. 启动本地区块链（终端 1）

```bash
pnpm start:zkp
```

Anvil 将在 `http://127.0.0.1:8545` 启动，Chain ID 为 `31337`，预置 20 个测试账户。

### 3. 部署合约（终端 2）

```bash
pnpm deploy:contracts
```

该命令依次完成：

1. 部署 `UltraVerifier`（PLONK 验证合约）和 `ZK_KYC`（主合约）
2. 批量注册 3 个测试用户（alice、bob、eve）
3. 创建 20 个候选人提案（Alice Morgan、Bob Chen、Carlos Rivera 等）
4. 自动将合约地址同步到 `packages/server/.env` 和 `packages/client/.env.local`

### 4. 启动前后端（终端 2）

```bash
pnpm start
```

- 前端：http://localhost:3000
- 后端：http://localhost:4000

### 5. 配置钱包

在 MetaMask 中添加 Anvil 本地网络：

| 参数     | 值                        |
| -------- | ------------------------- |
| 网络名称 | Localhost 8545            |
| RPC URL  | `http://127.0.0.1:8545` |
| Chain ID | `31337`                 |
| 代币符号 | ETH                       |

可从 Anvil 启动日志中导入测试账户私钥以获取测试 ETH。

---

## 配置说明

项目中所有运行时地址均从环境变量读取，**不存在硬编码地址**。部署脚本会自动同步。

### 环境变量

**前端** — `packages/client/.env.local`（自动生成）：

```env
REACT_APP_ZK_KYC_ADDRESS=0x...  # 合约地址（必需，缺失则启动失败）
REACT_APP_API_URL=http://localhost:4000  # 后端 API 地址
```

**后端** — `packages/server/.env`（自动更新）：

```env
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PORT=4000
ZK_KYC_ADDRESS=0x...  # 合约地址（必需，缺失则进程退出）
```

### 地址同步机制

```
Deploy.s.sol
  │
  ├── 部署合约并写入 cache/zk_kyc_address.txt
  │
  └── deploy:contracts 脚本尾部调用 sync-contract-address.cjs
        │
        ├── 读取 cache/zk_kyc_address.txt（或回退到 broadcast JSON）
        ├── 写入 packages/server/.env → ZK_KYC_ADDRESS
        └── 写入 packages/client/.env.local → REACT_APP_ZK_KYC_ADDRESS
```

重新部署后只需重启前后端即可，无需手动修改任何配置文件。

---

## 使用指南

### 1. 注册

1. 打开 http://localhost:3000
2. 在输入框中输入用户名
3. 点击 **Register to Vote**
4. 按照浏览器提示完成 WebAuthn 验证（指纹/Face ID/安全密钥）

### 2. 请求 KYC

1. 输入已注册的用户名
2. 点击 **Request KYC**
3. 再次完成 WebAuthn 认证
4. 系统会：
   - 从 WebAuthn 签名派生确定性以太坊钱包
   - 计算用户的 Poseidon 承诺值
   - 通过后端将用户注册到智能合约的 Merkle 树中
   - 将 `leafIndex`、`secret`、`nulifier` 保存在浏览器 localStorage

### 3. 投票

1. 页面加载后自动从后端 `/results` 接口获取 20 个候选人列表
2. 从候选人网格中选择 **1 名** 候选人
3. 点击 **Submit Vote**，系统在浏览器端：
   - 通过后端 `/merkle-proof/:leafIndex` 接口获取 Merkle 证明路径（32 层兄弟节点 + 路径索引）
   - 计算 nullifierHash = Poseidon2([nulifier, proposalId])
   - 使用 Noir WASM 在本地生成 PLONK 零知识证明（缓存后端实例以加速后续调用）
   - 将证明提交到后端 `/vote` 接口，后端转发到合约进行链上验证和计票
4. 投票提交成功后页面自动刷新候选人票数

> 首次证明生成需要一定时间（加载 WASM 约 30 秒），后续调用因缓存会显著加快。

---

## 零知识电路详解

电路位于 `packages/zkp/circuits/src/main.nr`，前端同步了一份到 `packages/client/src/circuit/src/main.nr`。

### 输入

| 类型 | 名称                     | 说明                                          |
| ---- | ------------------------ | --------------------------------------------- |
| 公开 | `root`                 | 当前 Merkle 树根                              |
| 公开 | `nulifierHash`         | Poseidon2([nulifier, proposalId])，用于防重投 |
| 公开 | `proposalId`           | 提案编号                                      |
| 公开 | `voteType`             | 投票类型（始终为 1 = 赞成）                   |
| 私有 | `nulifier`             | 用户私有 nullifier                            |
| 私有 | `secret`               | 用户私有秘密值                                |
| 私有 | `proofSiblings[32]`    | Merkle 证明的兄弟节点                         |
| 私有 | `proofPathIndices[32]` | Merkle 路径的方向标记（0 = 左，1 = 右）       |

### 验证逻辑

```
1. 计算叶节点哈希
   leaf = Poseidon2([nulifier, secret])

2. 验证 nullifier 哈希
   assert Poseidon2([nulifier, proposalId]) == nulifierHash

3. Merkle 成员验证（32 轮）
   for i in 0..32:
       if proofPathIndices[i] == 0:
           hash = Poseidon2([hash, proofSiblings[i]])
       else:
           hash = Poseidon2([proofSiblings[i], hash])

4. 验证最终哈希等于公开的根
   assert hash == root
```

这套逻辑保证了：证明者知道某个有效的 (nulifier, secret) 对，它对应的叶节点确实在当前 Merkle 树中——但不会暴露到底是哪个叶节点。

---

## 智能合约详解

### ZK_KYC.sol — 主合约

继承自 `CryptoTools`（Merkle 树操作），核心功能：

| 函数                                                               | 访问控制   | 说明                                    |
| ------------------------------------------------------------------ | ---------- | --------------------------------------- |
| `requestRegistration(username, commitment)`                      | 任何人     | 用户提交注册请求                        |
| `registerUser(username)`                                         | 仅管理员   | 审批单个用户，插入 Merkle 叶            |
| `registerMultipleUsers(usernames[], addresses[], commitments[])` | 仅管理员   | 批量审批，发出 `UsersRegistered` 事件 |
| `createProposal(username, description, data)`                    | 已认证用户 | 创建投票提案                            |
| `vote(proof, publicInputs[])`                                    | 任何人     | 提交 ZK 证明投票，合约验证后计票        |
| `batchVote(proofs[], publicInputs[][])`                          | 任何人     | 批量投票                                |
| `getVoteStatus(proposalId)`                                      | 只读       | 查询提案投票数据                        |
| `getCurrentRoot()`                                               | 只读       | 获取当前 Merkle 根                      |
| `createProof(leafIndex)`                                         | 只读       | 获取指定叶的 Merkle 证明路径            |

### CryptoTools.sol — Merkle 树基础设施

- 32 层增量二叉 Merkle 树
- 维护最近 32 个根的历史记录（`isValidRoot()` 支持并发场景）
- 使用 Poseidon T3 作为树节点哈希函数

### 库合约

| 合约                      | 功能                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `plonk_vk.sol`          | Noir 自动生成的 PLONK 验证器，提供 `verify(proof, publicInputs)` |
| `PoseidonT2.sol`        | Poseidon 哈希（1 个输入）                                          |
| `PoseidonT3.sol`        | Poseidon 哈希（2 个输入），用于 Merkle 树                          |
| `InternalBinaryIMT.sol` | 增量 Merkle 树的底层实现，含预计算的零值                           |
| `Constants.sol`         | BN254 标量域模数、最大树深度（32）                                 |

---

## 开发与调试

### Noir 电路

```bash
cd packages/zkp/circuits

# 编译电路
nargo build

# 检查电路约束
nargo check

# 用 Prover.toml 中的样本数据生成证明
nargo prove

# 验证已生成的证明
nargo verify
```

### Solidity 合约

```bash
cd packages/zkp

# 编译全部合约
forge build

# 运行测试
forge test -vvv

# 只运行单个测试文件
forge test --match-path test/zkKYC.t.sol -vvv
forge test --match-path test/zkVote.t.sol -vvv
```

### 单独运行 Foundry 脚本

所有脚本通过 `ScriptConfig.s.sol` 基类自动读取合约地址。

```bash
cd packages/zkp

# 部署
forge script script/Deploy.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# 批量注册
forge script script/BatchRegister.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# 创建提案
forge script script/SubmitProposal.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# 查询提案状态
forge script script/GetValue.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 前后端单独启动

```bash
# 只启动后端（dev 模式，自动重载）
pnpm --filter ./packages/server dev

# 只启动前端
pnpm --filter ./packages/client start
```

---

## 隐私保护机制

### 1. 身份与投票分离

用户注册时在链上留下的是 Poseidon 承诺哈希（`Poseidon2([secret, nulifier])`），而非用户名或地址。投票时提交的是零知识证明，合约只验证"该证明对应的叶节点确实存在于 Merkle 树中"，完全不知道是哪个叶节点。

### 2. Nullifier 防重投

每次投票生成 `nullifierHash = Poseidon2([nulifier, proposalId])`。合约记录已使用的 nullifierHash，同一用户对同一提案再次投票会被拒绝。但由于 nullifier 是私有输入，外部观察者无法将两张不同提案的票关联到同一个人。

### 3. Merkle 树隐私

用户不需要在链上公开自己的承诺值或叶索引。只需通过 Merkle 证明路径（私有输入）证明自己是树中的某个叶节点。树根是公开的，但从树根无法反推出是谁在投票。

### 4. 零知识保证

PLONK 证明的零知识属性确保：验证者（合约及所有链上观察者）除了知道"该投票有效且未重复"之外，无法获取关于投票者身份的任何信息。

---

## 常见问题

**Q: 每次重新部署合约后地址会变吗？**
A: 会。但 `deploy:contracts` 脚本会自动同步新地址到前后端配置文件。只需重启前后端服务即可，无需手动修改。

**Q: 可以在真实的以太坊网络上运行吗？**
A: 当前配置面向本地开发。若要部署到测试网或主网，需要：

- 将 `RPC_URL` 改为对应网络的 RPC 端点
- 使用有真实余额的私钥
- 删除 Anvil 的 `--code-size-limit` 设置（或确保合约大小在 EIP-170 限制内）
- 配置合理的 Gas 策略

**Q: WebAuthn 注册失败？**
A: 请确认：

- 通过 `https://` 或 `http://localhost` 访问（WebAuthn 要求安全上下文）
- 浏览器支持 WebAuthn（Chrome、Firefox、Safari、Edge 等主流浏览器均支持）
- 设备具有生物识别或安全密钥硬件

**Q: 零知识证明生成很慢？**
A: 正常现象。PLONK 证明涉及大量多项式运算。首次调用需要加载 WASM 后端（约 30 秒），后续调用因缓存会显著加快。浏览器利用多线程 WASM 加速。

**Q: Windows 上 `pnpm` 不可用？**
A: PowerShell 执行策略可能阻止 `.ps1` 包装脚本。请使用 `pnpm.cmd` 代替 `pnpm`。

---

## 相关资源

- [Noir 语言文档](https://noir-lang.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [WebAuthn 指南](https://webauthn.guide/)
- [Web3Modal 文档](https://docs.walletconnect.com/web3modal/about)
- [ethers.js v6 文档](https://docs.ethers.org/v6/)
- [Poseidon 哈希](https://www.poseidon-hash.info/)
- [Chakra UI](https://chakra-ui.com/)

---

## 许可证

ISC
