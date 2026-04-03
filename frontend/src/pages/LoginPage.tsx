import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import api, { setToken } from "../api";

export default function LoginPage() {
  const nav = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Card style={{ width: 400 }} title="Crypto Quant 后台登录">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          本地调试默认账号：<Typography.Text code>admin</Typography.Text> /{" "}
          <Typography.Text code>123456</Typography.Text>
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={async (v) => {
            try {
              const { data } = await api.post("/auth/login", v);
              setToken(data.access_token);
              if (data.must_change_password) {
                nav("/change-password");
              } else {
                nav("/dashboard");
              }
            } catch {
              message.error("登录失败：用户名或密码错误");
            }
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
