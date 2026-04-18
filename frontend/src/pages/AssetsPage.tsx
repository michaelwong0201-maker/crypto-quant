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

  const spot = summary.spot_balances ?? [];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        资产收益（现货）
      </Typography.Title>
      {summary.note != null && (
        <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="说明">{summary.note}</Descriptions.Item>
        </Descriptions>
      )}
      <Card title="现货账户（非零余额）" style={{ marginBottom: 16 }}>
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
    </div>
  );
}
