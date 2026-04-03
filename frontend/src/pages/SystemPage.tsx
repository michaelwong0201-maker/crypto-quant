import { Card, Typography } from "antd";
import { useEffect, useState } from "react";
import api from "../api";

export default function SystemPage() {
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get("/system/status");
        setPayload(data);
      } catch {
        setPayload({ error: "无法加载（viewer 权限受限或网络错误）" });
      }
    })();
  }, []);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        系统监控
      </Typography.Title>
      <Card>
        <Typography.Paragraph type="secondary">
          健康检查接口：<Typography.Text code>/health</Typography.Text>；以下为依赖探测（需 admin/operator）。
        </Typography.Paragraph>
        <pre style={{ background: "#fafafa", padding: 12, borderRadius: 8, overflow: "auto" }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
