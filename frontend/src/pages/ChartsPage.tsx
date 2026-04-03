import { Card, Form, Input, Select, Table, Typography, Button, message } from "antd";
import { useState } from "react";
import api from "../api";

export default function ChartsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        数据图表
      </Typography.Title>
      <Card title="K 线数据（测试网公开接口）">
        <Form
          layout="inline"
          initialValues={{ symbol: "BTCUSDT", interval: "1m", market: "spot", limit: 50 }}
          onFinish={async (v) => {
            try {
              const { data } = await api.get("/market/klines", { params: v });
              setRows(data.rows);
              setMeta({ symbol: data.symbol, interval: data.interval, market: data.market });
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? "加载失败");
            }
          }}
        >
          <Form.Item name="symbol" label="交易对">
            <Input style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="interval" label="周期">
            <Select
              style={{ width: 100 }}
              options={["1m", "5m", "15m", "1h"].map((x) => ({ value: x, label: x }))}
            />
          </Form.Item>
          <Form.Item name="market" label="市场">
            <Select
              style={{ width: 140 }}
              options={[
                { value: "spot", label: "现货" },
                { value: "futures_usdt", label: "U 本位合约" },
              ]}
            />
          </Form.Item>
          <Form.Item name="limit" label="条数">
            <Input style={{ width: 80 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
          </Form.Item>
        </Form>
        {meta && (
          <Typography.Paragraph type="secondary">
            {meta.symbol} / {meta.interval} / {meta.market}
          </Typography.Paragraph>
        )}
        <Table
          size="small"
          rowKey={(r) => r.open_time}
          pagination={false}
          dataSource={rows}
          scroll={{ x: true }}
          columns={[
            { title: "开盘时间", dataIndex: "open_time", width: 160 },
            { title: "开", dataIndex: "open" },
            { title: "高", dataIndex: "high" },
            { title: "低", dataIndex: "low" },
            { title: "收", dataIndex: "close" },
            { title: "量", dataIndex: "volume" },
          ]}
        />
      </Card>
    </div>
  );
}
