# Cloudflare API Proxy Worker

这个 Worker 只拦截：

```txt
test.282628.xyz/api/*
```

并转发到 `wrangler.toml` 中的 `BACKEND_ORIGIN`。

## 配置

修改 `wrangler.toml`：

```toml
[vars]
BACKEND_ORIGIN = "http://你的NLB-DNS地址"
STRIP_API_PREFIX = "true"
```

如果后端真实接口是：

```txt
https://backend.example.com/user/list
```

保持：

```toml
STRIP_API_PREFIX = "true"
```

如果后端真实接口是：

```txt
https://backend.example.com/api/user/list
```

改成：

```toml
STRIP_API_PREFIX = "false"
```

## 部署

```bash
npm install
npm run deploy
```

部署后，前端请求：

```js
fetch('/api/user/list')
```

会经过 Worker 转发到后端。
