import { Button, Card, Form, Input, InputNumber, Select, Space, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function StrategiesPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await api.get("/strategies");
    setRows(data);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        策略引擎
      </Typography.Title>
      <Card title="新建策略实例（simple_ma）" style={{ marginBottom: 16 }}>
        <Form
          layout="vertical"
          style={{ maxWidth: 520 }}
          initialValues={{
            strategy_key: "simple_ma",
            name: "BTC 双均线",
            symbol: "BTCUSDT",
            market_type: "spot",
            fast: 5,
            slow: 20,
            interval: "1m",
            quantity: "0.001",
            poll_seconds: 60,
          }}
          onFinish={async (v) => {
            try {
              await api.post("/strategies", {
                name: v.name,
                strategy_key: v.strategy_key,
                config: {
                  symbol: v.symbol,
                  market_type: v.market_type,
                  fast: v.fast,
                  slow: v.slow,
                  interval: v.interval,
                  quantity: String(v.quantity),
                  poll_seconds: v.poll_seconds,
                },
              });
              message.success("已创建");
              void load();
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? "创建失败");
            }
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="strategy_key" label="策略类型" rules={[{ required: true }]}>
            <Select
              options={[{ value: "simple_ma", label: "双均线（简化）" }]}
              disabled
            />
          </Form.Item>
          <Space wrap>
            <Form.Item name="symbol" label="交易对" rules={[{ required: true }]}>
              <Input style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="market_type" label="市场" rules={[{ required: true }]}>
              <Select
                style={{ width: 140 }}
                options={[
                  { value: "spot", label: "现货测试网" },
                  { value: "futures_usdt", label: "合约测试网" },
                ]}
              />
            </Form.Item>
            <Form.Item name="interval" label="K 线周期" rules={[{ required: true }]}>
              <Input style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Space wrap>
            <Form.Item name="fast" label="快线" rules={[{ required: true }]}>
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="slow" label="慢线" rules={[{ required: true }]}>
              <InputNumber min={2} />
            </Form.Item>
            <Form.Item name="quantity" label="下单数量（基础资产）" rules={[{ required: true }]}>
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="poll_seconds" label="轮询秒数" rules={[{ required: true }]}>
              <InputNumber min={5} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit">
            创建
          </Button>
        </Form>
      </Card>
      <Card title="实例列表">
        <Table
          size="small"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            { title: "名称", dataIndex: "name" },
            { title: "类型", dataIndex: "strategy_key" },
            { title: "运行中", dataIndex: "running", render: (v: boolean) => (v ? "是" : "否") },
            {
              title: "操作",
              render: (_, r: any) => (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    onClick={async () => {
                      try {
                        await api.post(`/strategies/${r.id}/start`);
                        message.success("已启动");
                        void load();
                      } catch (e: any) {
                        message.error(e?.response?.data?.detail ?? "启动失败");
                      }
                    }}
                  >
                    启动
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/strategies/${r.id}/stop`);
                        message.success("已停止");
                        void load();
                      } catch (e: any) {
                        message.error(e?.response?.data?.detail ?? "停止失败");
                      }
                    }}
                  >
                    停止
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
