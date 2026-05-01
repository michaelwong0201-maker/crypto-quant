(function () {
  "use strict";

  var exact = {
    "This page allows you to control your trading bot.": "你可以在这里管理和监控量化交易机器人。",
    "Current Value - In futures mode Collateral + PnL": "当前价值 - 合约模式下为保证金 + 盈亏",
    "No strategy selected, can't load plot config.": "未选择策略，无法加载绘图配置。",
    "If you need any help, please refer to the": "如需帮助，请参考",
    "Have fun - wishes you the Freqtrade team": "Freqtrade 团队祝你使用愉快。",
    "Use Heikin Ashi candles in your charts": "图表使用 Heikin Ashi 平均 K 线",
    "Download Trades instead of OHLCV data": "下载成交数据而不是 K 线数据",
    "Name and Password are required.": "请输入用户名和密码。",
    "Prepend data when downloading": "下载时向前补齐数据",
    "Welcome to the Freqtrade UI": "欢迎使用 Freqtrade 量化交易控制台",
    "Currently no open trades.": "当前没有持仓。",
    "Remove indicator to plot": "从图表移除指标",
    "No closed trades so far.": "暂无已平仓交易。",
    "Freqtrade Documentation": "Freqtrade 官方文档",
    "Use Heikin Ashi candles": "使用 Heikin Ashi 平均 K 线",
    "Indicators in this plot": "当前图表指标",
    "Showing Account balance": "显示账户资产",
    "Pairlist Configuration": "交易对列表配置",
    "No indicators selected": "未选择指标",
    "Backtesting parameters": "回测参数",
    "All USDT Futures Pairs": "全部 USDT 永续合约交易对",
    "Notification Settings": "通知设置",
    "Pause - Stop Entering": "暂停开仓",
    "Show Tags in Tooltips": "在提示框中显示标签",
    "Add indicator to plot": "添加指标到图表",
    "Current stoploss dist": "当前止损距离",
    "Stoploss last updated": "止损最后更新时间",
    "Lock dynamic layouts": "锁定动态布局",
    "Load backtest result": "加载回测结果",
    "Backtesting settings": "回测设置",
    "Use strategy default": "使用策略默认值",
    "No strategy selected": "未选择策略",
    "No trades to show...": "暂无交易可显示...",
    "No available options": "没有可用选项",
    "Freqtrade bot Login": "Freqtrade 机器人登录",
    "Lock dynamic Layout": "锁定动态布局",
    "Lock dynamic layout": "锁定动态布局",
    "Strategy parameters": "策略参数",
    "Profit Distribution": "收益分布",
    "Profit distribution": "收益分布",
    "Scatter symbol size": "散点标记大小",
    "Backtesting summary": "回测汇总",
    "Backtesting metrics": "回测指标",
    "Showing Bot balance": "显示机器人资产",
    "Hide small balances": "隐藏小额资产",
    "Erase existing data": "清除已有数据",
    "Select Candle Types": "选择 K 线类型",
    "Failed to load data": "数据加载失败",
    "Total stake amount": "总投入金额",
    "Long entry signals": "做多开仓信号",
    "Short exit signals": "做空平仓信号",
    "plot configuration": "绘图配置",
    "Freqtrade Backtest": "Freqtrade 回测",
    "Available results:": "可用回测结果：",
    "Worst single Trade": "最差单笔交易",
    "Periodic breakdown": "周期统计",
    "Use config default": "使用配置默认值",
    "No Trades to show.": "暂无交易可显示。",
    "Pairlist not found": "未找到交易对列表",
    "Login to your bot": "登录到交易机器人",
    "Toggle Night Mode": "切换夜间模式",
    "Running Freqtrade": "Freqtrade 正在运行",
    "Total Trade count": "总交易次数",
    "Strategy settings": "策略设置",
    "Select timeframes": "选择周期",
    "Starting capital:": "初始资金：",
    "Cumulative Profit": "累计收益",
    "Long exit signals": "做多平仓信号",
    "Plot Configurator": "绘图配置器",
    "Plot configurator": "绘图配置器",
    "Add new indicator": "添加新指标",
    "Backtest running:": "回测运行中：",
    "Best single Trade": "最佳单笔交易",
    "Drawdown duration": "回撤持续时间",
    "Freqtrade Balance": "Freqtrade 资产",
    "Show all balances": "显示全部资产",
    "Liquidation Price": "强平价格",
    "Trailing Stoploss": "跟踪止损",
    "Days to download:": "下载天数：",
    "No data available": "暂无数据",
    "Whitelist Methods": "白名单生成方式",
    "Evaluate pairlist": "评估交易对列表",
    "API URL required": "请输入 API 地址",
    "Invalid Password": "密码错误",
    "Advanced Options": "高级选项",
    "Current profit %": "当前收益率",
    "Show Chart Areas": "显示图表区域",
    "Plot config name": "绘图配置名称",
    "Remove indicator": "移除指标",
    "Current Drawdown": "当前回撤",
    "Initial Stoploss": "初始止损",
    "Downloading Data": "正在下载数据",
    "Days to download": "下载天数",
    "No pair selected": "未选择交易对",
    "No results found": "没有找到结果",
    "No selected item": "未选择项目",
    "Datepicker input": "日期选择输入框",
    "No bot selected": "未选择机器人",
    "FreqUI Settings": "FreqUI 设置",
    "Trade durations": "持仓时长",
    "Pairlist Config": "交易对列表配置",
    "Stake currency:": "投入币种：",
    "Unlimited stake": "不限投入金额",
    "Current profit:": "当前收益：",
    "Realized profit": "已实现收益",
    "Realized Profit": "已实现收益",
    "Absolute profit": "绝对收益",
    "Relative profit": "相对收益",
    "Compare results": "对比结果",
    "Market change %": "市场涨跌幅",
    "Custom Stoploss": "自定义止损",
    "Select Template": "选择模板",
    "Not loaded yet.": "尚未加载。",
    "No open Trades.": "暂无当前持仓。",
    "Datepicker menu": "日期选择菜单",
    "Custom Exchange": "自定义交易所",
    "Available bots": "可用机器人",
    "Force exit all": "强制全部平仓",
    "Trade duration": "持仓时长",
    "Time Selection": "时间选择",
    "Current profit": "当前收益",
    "Short entries:": "做空开仓：",
    "Enter Position": "开仓",
    "Chart settings": "图表设置",
    "Start backtest": "开始回测",
    "Reset Backtest": "重置回测",
    "Analyze result": "分析结果",
    "Winning trades": "盈利交易",
    "Winning Trades": "盈利交易",
    "Drawdown start": "回撤开始",
    "Trading volume": "交易量",
    "Time Breakdown": "时间维度统计",
    "Position value": "仓位价值",
    "Start Download": "开始下载",
    "All USDT Pairs": "全部 USDT 交易对",
    "Apply Template": "应用模板",
    "No file chosen": "未选择文件",
    "StaticPairList": "固定交易对列表",
    "VolumePairList": "成交量交易对列表",
    "Start Trading": "启动交易",
    "ForceExit all": "强制全部平仓",
    "Closed Trades": "已平仓交易",
    "Trade history": "交易历史",
    "Stake amount:": "投入金额：",
    "Profit factor": "盈利因子",
    "Profit Factor": "盈利因子",
    "Closed Profit": "已实现收益",
    "Long entries:": "做多开仓：",
    "Short entries": "做空开仓",
    "Exit Position": "平仓",
    "Premium Index": "溢价指数",
    "Refresh chart": "刷新图表",
    "Stop Backtest": "停止回测",
    "Backtest Time": "回测耗时",
    "Delete result": "删除结果",
    "Losing trades": "亏损交易",
    "Losing Trades": "亏损交易",
    "Market change": "市场涨跌幅",
    "Interest rate": "利率",
    "Download Data": "下载数据",
    "Download data": "下载数据",
    "Use Live Data": "使用实时数据",
    "Freqtrade UI": "Freqtrade UI",
    "Reset Layout": "重置布局",
    "Reset layout": "重置布局",
    "Auto Refresh": "自动刷新",
    "Running with": "运行模式",
    "Trade Detail": "交易详情",
    "Select Pairs": "选择交易对",
    "Stake amount": "投入金额",
    "Total profit": "总收益",
    "Total Profit": "总收益",
    "Daily profit": "日收益",
    "Current Rate": "当前价",
    "Current rate": "当前价",
    "Close Reason": "平仓原因",
    "Long / Short": "多头 / 空头",
    "Long entries": "做多开仓",
    "Short exits:": "做空平仓：",
    "Funding Rate": "资金费率",
    "Run backtest": "运行回测",
    "Max Drawdown": "最大回撤",
    "Drawdown end": "回撤结束",
    "Funding fees": "资金费用",
    "Use template": "使用模板",
    "Use Template": "使用模板",
    "Not Selected": "未选择",
    "Month picker": "月份选择器",
    "Add new bot": "添加机器人",
    "UI settings": "界面设置",
    "UI Version:": "界面版本：",
    "Force Entry": "强制开仓",
    "Open Trades": "当前持仓",
    "Open trades": "当前持仓",
    "Trade count": "交易次数",
    "Trade Count": "交易次数",
    "Total Stake": "总投入",
    "Open Profit": "浮动收益",
    "Exit Reason": "平仓原因",
    "Short entry": "做空开仓",
    "Short exits": "做空平仓",
    "Heikin Ashi": "Heikin Ashi 平均 K 线",
    "Target Plot": "目标图表",
    "Backtesting": "回测",
    "Time picker": "时间选择器",
    "Year picker": "年份选择器",
    "Unsupported": "暂不支持的交易所",
    "Force Exit": "强制平仓",
    "All Trades": "全部交易",
    "All trades": "全部交易",
    "Trades Log": "交易日志",
    "Trades log": "交易日志",
    "Pair Locks": "交易对锁定",
    "Close Rate": "平仓价",
    "Close rate": "平仓价",
    "Close date": "平仓时间",
    "Open since": "开仓时间",
    "Long entry": "做多开仓",
    "Long exit:": "做多平仓：",
    "Short exit": "做空平仓",
    "Win / Loss": "盈利 / 亏损",
    "Best pair:": "最佳交易对：",
    "Worst Pair": "最差交易对",
    "Fees close": "平仓手续费",
    "Multi Pane": "多面板",
    "Multi pair": "多交易对",
    "Start Date": "开始日期",
    "Copy from:": "复制自：",
    "Dashboard": "仪表盘",
    "Available": "可用",
    "Whitelist": "白名单",
    "Blacklist": "黑名单",
    "Timeframe": "周期",
    "Amount in": "金额，单位",
    "Open Rate": "开仓价",
    "Open rate": "开仓价",
    "Open date": "开仓时间",
    "Entry tag": "开仓标签",
    "Enter Tag": "开仓标签",
    "Long exit": "做多平仓",
    "Best Pair": "最佳交易对",
    "Worst day": "最差日期",
    "Breakdown": "拆分统计",
    "Wednesday": "星期三",
    "Supported": "支持的交易所",
    "Completed": "已完成",
    "Settings": "设置",
    "Bot name": "机器人名称",
    "Bot Name": "机器人名称",
    "Username": "用户名",
    "Password": "密码",
    "Stop Bot": "停止机器人",
    "Trade Id": "交易 ID",
    "Exchange": "交易所",
    "Strategy": "策略",
    "Profit %": "收益率",
    "Max Rate": "最高价",
    "Min Rate": "最低价",
    "Exit Tag": "平仓标签",
    "Backtest": "回测",
    "Win Rate": "胜率",
    "Best day": "最佳日期",
    "End Date": "结束日期",
    "Thursday": "星期四",
    "Saturday": "星期六",
    "isolated": "逐仓",
    "Trading": "交易",
    "API Url": "API 地址",
    "Confirm": "确认",
    "Refresh": "刷新",
    "Actions": "操作",
    "Dry run": "模拟交易",
    "Dry Run": "模拟交易",
    "dry_run": "模拟交易",
    "Mix Tag": "混合标签",
    "Entries": "开仓",
    "Candles": "K 线",
    "Balance": "资产",
    "Futures": "合约",
    "futures": "合约",
    "Tuesday": "星期二",
    "Copied!": "已复制！",
    "Pending": "待处理",
    "FreqUI": "FreqUI 控制台",
    "Charts": "行情图表",
    "Graphs": "图表",
    "Logout": "退出登录",
    "Cancel": "取消",
    "Choose": "选择",
    "Upload": "上传",
    "Submit": "提交",
    "Delete": "删除",
    "Remove": "移除",
    "Search": "搜索",
    "Filter": "筛选",
    "Action": "操作",
    "Trades": "交易",
    "Amount": "数量",
    "Profit": "收益",
    "Candle": "K 线",
    "Volume": "成交量",
    "Sunday": "星期日",
    "Monday": "星期一",
    "Friday": "星期五",
    "market": "市价",
    "Closed": "已关闭",
    "Trade": "交易",
    "Chart": "图表",
    "Login": "登录",
    "Close": "关闭",
    "Apply": "应用",
    "Clear": "清除",
    "Reset": "重置",
    "Pairs": "交易对",
    "Price": "价格",
    "Rel %": "相对收益率",
    "Short": "空头",
    "short": "空头",
    "Entry": "开仓",
    "Exits": "平仓",
    "Index": "指数价格",
    "Today": "今天",
    "limit": "限价",
    "cross": "全仓",
    "Abort": "中止",
    "False": "否",
    "Home": "首页",
    "Logs": "日志",
    "Name": "名称",
    "Back": "返回",
    "Save": "保存",
    "Edit": "编辑",
    "Live": "实盘",
    "live": "实盘",
    "Pair": "交易对",
    "Long": "多头",
    "long": "多头",
    "Exit": "平仓",
    "Mark": "标记价格",
    "Spot": "现货",
    "spot": "现货",
    "sell": "卖出",
    "Open": "打开",
    "True": "是",
    "Log": "日志",
    "Add": "添加",
    "Sun": "周日",
    "Mon": "周一",
    "Tue": "周二",
    "Wed": "周三",
    "Thu": "周四",
    "Fri": "周五",
    "Sat": "周六",
    "buy": "买入",
    "Yes": "是",
    "N/A": "不适用",
    "No": "否"
  };

  var attrs = ["title", "aria-label", "aria-description", "placeholder", "alt"];
  var skipTags = { SCRIPT: true, STYLE: true, NOSCRIPT: true, CODE: true, PRE: true, KBD: true, SAMP: true };

  function normalize(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function translateText(raw) {
    if (!raw || !/[A-Za-z]/.test(raw)) return raw;

    var leading = raw.match(/^\s*/)[0];
    var trailing = raw.match(/\s*$/)[0];
    var text = normalize(raw);
    if (!text) return raw;

    if (/Have fun[\s\S]*Freqtrade team/i.test(text)) return leading + "Freqtrade 团队祝你使用愉快。" + trailing;
    if (exact[text]) return leading + exact[text] + trailing;
    if (text.endsWith(":")) {
      var base = text.slice(0, -1);
      if (exact[base]) return leading + exact[base] + "：" + trailing;
    }

    var regexRules = [
      [/^(.+) \(copy\)$/i, function (_, name) { return translateText(name) + "（副本）"; }],
      [/^(.+) ago$/i, function (_, amount) { return amount + "前"; }],
      [/^in (.+)$/i, function (_, unit) { return /^\d/.test(unit) ? unit + "后" : "以 " + unit + " 计"; }],
      [/^In (.+)$/i, function (_, unit) { return "以 " + unit + " 计"; }],
      [/^(\d+)\s+second(s)?$/i, function (_, n) { return n + " 秒"; }],
      [/^(\d+)\s+minute(s)?$/i, function (_, n) { return n + " 分钟"; }],
      [/^(\d+)\s+hour(s)?$/i, function (_, n) { return n + " 小时"; }],
      [/^(\d+)\s+day(s)?$/i, function (_, n) { return n + " 天"; }],
      [/^(\d+)\s+week(s)?$/i, function (_, n) { return n + " 周"; }],
      [/^(\d+)\s+month(s)?$/i, function (_, n) { return n + " 个月"; }],
      [/^(\d+)\s+year(s)?$/i, function (_, n) { return n + " 年"; }],
      [/^(\d+)\s+pairs$/i, function (_, n) { return n + " 个交易对"; }],
      [/^(.+) markets, with Strategy (.+)$/i, function (_, count, strategy) { return count + " 个市场，策略：" + strategy; }],
      [/^Refreshing OHLCV for pair:\s*(.+)$/i, function (_, pair) { return "正在刷新交易对 K 线：" + pair; }],
      [/^with columns:\s*(.+)$/i, function (_, columns) { return "列：" + columns; }],
      [/^Profit: (.+)$/i, function (_, value) { return "收益：" + value; }],
      [/^Projected profit \(incl\. unrealized\): (.+)$/i, function (_, value) { return "预计收益（含浮动盈亏）：" + value; }],
      [/^Total Profit \(Open and realized\) (.+)$/i, function (_, value) { return "总收益（浮动 + 已实现）" + value; }],
      [/^Open since: (.+)$/i, function (_, value) { return "开仓时间：" + value; }],
      [/^Bot start date: (.+)$/i, function (_, value) { return "机器人启动时间：" + value; }],
      [/^Stake-amount in (.+)$/i, function (_, currency) { return "投入金额，单位 " + currency; }],
      [/^Amount in (.+)$/i, function (_, currency) { return "金额，单位 " + currency; }],
      [/^Tot Profit (.+)$/i, function (_, currency) { return "总收益 " + currency; }],
      [/^Profit (.+)$/i, function (_, currency) { return "收益 " + currency; }]
    ];

    for (var i = 0; i < regexRules.length; i += 1) {
      var match = text.match(regexRules[i][0]);
      if (match) return leading + regexRules[i][1].apply(null, match) + trailing;
    }

    return raw;
  }

  function translateNode(node) {
    if (!node || !node.nodeValue) return;
    var translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  function translateElement(element) {
    if (!element || skipTags[element.tagName]) return;
    for (var i = 0; i < attrs.length; i += 1) {
      var attr = attrs[i];
      var value = element.getAttribute && element.getAttribute(attr);
      if (!value) continue;
      var translated = translateText(value);
      if (translated !== value) element.setAttribute(attr, translated);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && skipTags[root.tagName]) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (node) {
        var parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return parent && skipTags[parent.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateNode(node);
      else translateElement(node);
      node = walker.nextNode();
    }
  }

  function installCanvasTextTranslator() {
    return;
  }

  function run() {
    try {
      document.documentElement.lang = "zh-CN";
      document.title = "Freqtrade 量化交易控制台";
      installCanvasTextTranslator();
      walk(document.body);
    } catch (error) {
      console.warn("[zh-cn-runtime] translation skipped:", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  window.addEventListener("load", run);
  [250, 1000, 2500, 5000].forEach(function (delay) { window.setTimeout(run, delay); });

  try {
    var pending = false;
    new MutationObserver(function (mutations) {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        for (var i = 0; i < mutations.length; i += 1) {
          var mutation = mutations[i];
          if (mutation.type === "characterData") translateNode(mutation.target);
          if (mutation.type === "attributes") translateElement(mutation.target);
          for (var j = 0; j < mutation.addedNodes.length; j += 1) walk(mutation.addedNodes[j]);
        }
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attrs });
  } catch (error) {
    console.warn("[zh-cn-runtime] observer disabled:", error);
  }

  window.FREQTRADE_ZH_CN = { refresh: run, translateText: translateText };
})();
