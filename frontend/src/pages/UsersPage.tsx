import { Button, Card, Form, Input, Select, Spin, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api";

export default function UsersPage() {
  const [role, setRole] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [pwd, setPwd] = useState<string | null>(null);

  const load = async () => {
    const { data } = await api.get("/users");
    setRows(data);
  };

  useEffect(() => {
    void (async () => {
      const { data } = await api.get("/auth/me");
      setRole(data.role);
      if (data.role === "admin") {
        void load();
      }
    })();
  }, []);

  if (role === null) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        账号管理
      </Typography.Title>
      <Card title="新建用户（随机初始密码，首次登录强制改密）" style={{ marginBottom: 16 }}>
        <Form
          layout="inline"
          onFinish={async (v) => {
            try {
              const { data } = await api.post("/users", v);
              setPwd(data.initial_password);
              message.success("已创建");
              void load();
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? "创建失败");
            }
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}>
            <Select
              style={{ width: 160 }}
              options={[
                { value: "viewer", label: "viewer" },
                { value: "operator", label: "operator" },
                { value: "admin", label: "admin" },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
        {pwd && (
          <Typography.Paragraph copyable={{ text: pwd }}>
            初始密码（仅显示一次）：<Typography.Text code>{pwd}</Typography.Text>
          </Typography.Paragraph>
        )}
      </Card>
      <Card title="用户列表">
        <Table
          size="small"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            { title: "用户名", dataIndex: "username" },
            { title: "角色", dataIndex: "role" },
            { title: "激活", dataIndex: "is_active", render: (v: boolean) => (v ? "是" : "否") },
            { title: "须改密", dataIndex: "must_change_password", render: (v: boolean) => (v ? "是" : "否") },
          ]}
        />
      </Card>
    </div>
  );
}
