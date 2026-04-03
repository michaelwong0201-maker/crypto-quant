import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      const { data: d } = await api.get("/dashboard/overview");
      setData(d);
    })();
  }, []);

  if (!data) return null;

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        概览
      </Typography.Title>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="订单数（可见范围）" value={data.order_count} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="策略实例数" value={data.strategy_instance_count} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="运行中策略任务" value={data.running_strategies} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 16 }} title="最近订单">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={data.recent_orders}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            { title: "品种", dataIndex: "symbol" },
            { title: "方向", dataIndex: "side" },
            { title: "状态", dataIndex: "status" },
            { title: "时间", dataIndex: "created_at" },
          ]}
        />
      </Card>
    </div>
  );
}
