import { Card, Descriptions, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function AssetsPage() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get("/assets/summary");
        setSummary(data);
      } catch (e: any) {
        message.error(e?.response?.data?.detail ?? "加载失败（需配置测试网密钥）");
      }
    })();
  }, []);

  if (!summary) return null;

  const spot = summary.balances_preview?.spot ?? [];
  const fut = summary.balances_preview?.futures_usdt ?? [];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        资产收益
      </Typography.Title>
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="说明">{summary.note}</Descriptions.Item>
      </Descriptions>
      <Card title="现货测试网（非零余额）" style={{ marginBottom: 16 }}>
        <Table
          size="small"
          rowKey={(r) => r.asset}
          pagination={false}
          dataSource={spot}
          columns={[
            { title: "资产", dataIndex: "asset" },
            { title: "可用", dataIndex: "free" },
            { title: "冻结", dataIndex: "locked" },
          ]}
        />
      </Card>
      <Card title="U 本位合约测试网">
        <Table
          size="small"
          rowKey={(r) => r.asset}
          pagination={false}
          dataSource={fut}
          columns={[
            { title: "资产", dataIndex: "asset" },
            { title: "余额", dataIndex: "balance" },
            { title: "可用", dataIndex: "availableBalance" },
          ]}
        />
      </Card>
    </div>
  );
}
