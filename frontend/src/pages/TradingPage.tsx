import { Button, Card, Form, Input, Select, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function TradingPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await api.get("/trading/orders");
    setRows(data);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        实盘交易（测试网）
      </Typography.Title>
      <Card title="手动市价单（经风控）" style={{ marginBottom: 16 }}>
        <Form
          layout="inline"
          onFinish={async (v) => {
            try {
              await api.post("/trading/orders", {
                symbol: v.symbol,
                side: v.side,
                quantity: v.quantity,
                market_type: v.market_type,
              });
              message.success("已提交");
              void load();
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? "下单失败");
            }
          }}
        >
          <Form.Item name="symbol" label="交易对" initialValue="BTCUSDT" rules={[{ required: true }]}>
            <Input style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="side" label="方向" initialValue="BUY" rules={[{ required: true }]}>
            <Select
              style={{ width: 100 }}
              options={[
                { value: "BUY", label: "买入" },
                { value: "SELL", label: "卖出" },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <Input style={{ width: 140 }} placeholder="基础资产数量" />
          </Form.Item>
          <Form.Item name="market_type" label="市场" initialValue="spot" rules={[{ required: true }]}>
            <Select
              style={{ width: 160 }}
              options={[
                { value: "spot", label: "现货测试网" },
                { value: "futures_usdt", label: "合约测试网" },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              下单
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title="订单记录">
        <Table
          size="small"
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            { title: "品种", dataIndex: "symbol" },
            { title: "方向", dataIndex: "side" },
            { title: "数量", dataIndex: "quantity" },
            { title: "市场", dataIndex: "market_type" },
            { title: "状态", dataIndex: "status" },
            { title: "交易所订单号", dataIndex: "exchange_order_id" },
            { title: "时间", dataIndex: "created_at" },
          ]}
        />
      </Card>
    </div>
  );
}
