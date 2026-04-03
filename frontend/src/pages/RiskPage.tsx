import { Button, Card, Form, InputNumber, Switch, Typography, message } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function RiskPage() {
  const [form] = Form.useForm();
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const { data } = await api.get("/auth/me");
      setRole(data.role);
      const rs = await api.get("/risk/settings");
      form.setFieldsValue({
        trading_enabled: rs.data.trading_enabled,
        max_order_notional_usd: Number(rs.data.max_order_notional_usd),
      });
    })();
  }, [form]);

  const canEdit = role === "admin" || role === "operator";

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        风控配置
      </Typography.Title>
      <Card>
        {!canEdit && (
          <Typography.Paragraph type="secondary">只读账号不可修改风控参数。</Typography.Paragraph>
        )}
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 480 }}
          onFinish={async (v) => {
            if (!canEdit) return;
            try {
              await api.put("/risk/settings", v);
              message.success("已保存");
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? "保存失败");
            }
          }}
        >
          <Form.Item name="trading_enabled" label="允许交易" valuePropName="checked">
            <Switch disabled={!canEdit} />
          </Form.Item>
          <Form.Item
            name="max_order_notional_usd"
            label="单笔最大名义（USD 估值，用于简单风控闸）"
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} disabled={!canEdit} />
          </Form.Item>
          {canEdit && (
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          )}
        </Form>
      </Card>
    </div>
  );
}
