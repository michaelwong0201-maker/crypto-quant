import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ChangePasswordPage() {
  const nav = useNavigate();

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: 16 }}>
      <Card title="首次登录须修改密码">
        <Typography.Paragraph type="secondary">
          根据系统规则，新账号首次登录后必须修改密码后才能使用交易与策略等功能。
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={async (v) => {
            try {
              await api.post("/auth/change-password", {
                current_password: v.current,
                new_password: v.next,
              });
              message.success("密码已更新");
              nav("/dashboard");
            } catch {
              message.error("修改失败：请检查当前密码");
            }
          }}
        >
          <Form.Item name="current" label="当前密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="next"
            label="新密码"
            rules={[{ required: true, min: 6, message: "至少 6 位" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="next2"
            label="确认新密码"
            dependencies={["next"]}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("next") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入不一致"));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
