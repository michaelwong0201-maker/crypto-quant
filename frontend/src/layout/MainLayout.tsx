import { useEffect, useState } from "react";
import { Layout, Menu, Button, theme, Spin } from "antd";
import {
  DashboardOutlined,
  LineChartOutlined,
  StockOutlined,
  FundOutlined,
  ControlOutlined,
  MonitorOutlined,
  UserOutlined,
  LogoutOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import api, { loadStoredToken } from "../api";

const { Header, Sider, Content } = Layout;

type Me = { username: string; role: string; must_change_password: boolean };

export default function MainLayout({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const { token: themeToken } = theme.useToken();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredToken();
    void (async () => {
      try {
        const { data } = await api.get<Me>("/auth/me");
        setMe(data);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav, loc.pathname]);

  if (loading || !me) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  if (me.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  const key = loc.pathname === "/" ? "/dashboard" : loc.pathname;

  const items = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: "概览" },
    { key: "/assets", icon: <WalletOutlined />, label: "资产收益" },
    { key: "/trading", icon: <StockOutlined />, label: "实盘交易" },
    { key: "/charts", icon: <LineChartOutlined />, label: "数据图表" },
    { key: "/strategies", icon: <ControlOutlined />, label: "策略引擎" },
    { key: "/risk", icon: <FundOutlined />, label: "风控配置" },
    { key: "/system", icon: <MonitorOutlined />, label: "系统监控" },
    { key: "/users", icon: <UserOutlined />, label: "账号管理" },
  ];

  return (
    <Layout style={{ minHeight: "100%" }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div
          style={{
            color: "#fff",
            fontWeight: 600,
            padding: 16,
            fontSize: 15,
          }}
        >
          Crypto Quant
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[key.startsWith("/dashboard") ? "/dashboard" : key]}
          items={items}
          onClick={({ key: k }) => nav(k)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: themeToken.colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            paddingInline: 16,
          }}
        >
          <span style={{ color: themeToken.colorTextSecondary }}>
            {me.username}（{me.role}）
          </span>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              onLogout();
              nav("/login");
            }}
          >
            退出
          </Button>
        </Header>
        <Content style={{ margin: 16 }}>
          <div
            style={{
              padding: 16,
              minHeight: 360,
              background: themeToken.colorBgContainer,
              borderRadius: themeToken.borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
