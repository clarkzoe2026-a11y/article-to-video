"""这篇文章的画面安排（说到哪句话时画面怎么动）。工具函数说明见 pipeline/shotlib.py。
用法：./a2v shots articles/2026-10-ai-website-to-server
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "pipeline"))
from shotlib import *  # noqa: E402,F401,F403

RB = load_redboxes(__file__)


def rb(img, i):  # 本文件里简写：rb("029", 0)
    import shotlib
    return shotlib.rb(RB, img, i)


# 10 步全流程图（008 / 093 同版式）的格子
COL = [0.013, 0.209, 0.404, 0.6, 0.796]


def cell(n):
    i = n - 1
    return [COL[i % 5], 0.321 if i < 5 else 0.63, 0.192, 0.293 if i < 5 else 0.305]


def cols(n, x0, x1, y0, y1, pad=0.005):
    """把一张横排插画均分成 n 列，返回每列的 rect"""
    w = (x1 - x0) / n
    return [[round(x0 + i * w + pad, 3), y0, round(w - 2 * pad, 3), y1 - y0] for i in range(n)]


WHO = cols(6, 0.02, 0.98, 0.45, 0.96)        # 006 适合人群 6 列
COST = cols(5, 0.02, 0.99, 0.17, 0.86)       # 007 成本 5 列
UPD = cols(6, 0.04, 0.97, 0.17, 0.7)         # 092 后续更新 6 列
DNS3 = cols(3, 0.02, 0.99, 0.13, 0.9)        # 019 DNS 三步

SHOTS = {
    "e1_hook": [
        full(at(0), "002", pop=True),
        zoom(at(3, "九十天"), "003", rb("003", 0)),
        full(at(5, "自己的服务器"), "001"),
    ],
    "e1_who": [
        full(at(0), "006"),
        spot(at(1, "受够了"), "006", WHO[0]),
        spot(at(1, "一直在线"), "006", WHO[1]),
        spot(at(2, "登录"), "006", WHO[2]),
        spot(at(2, "上传下载"), "006", WHO[3]),
        spot(at(2, "支付"), "006", WHO[4]),
        spot(at(3, "花点钱"), "006", WHO[5]),
        full(at(4), "006"),
    ],
    "e1_cost": [
        full(at(0), "007"),
        spot(at(1, "网站本身"), "007", COST[0]),
        spot(at(1, "GitHub"), "007", COST[1]),
        spot(at(1, "域名"), "007", COST[2]),
        spot(at(1, "服务器新手"), "007", COST[4]),
        full(at(2), "007"),
    ],
    "e1_map": [
        full(at(0), "008"),
        spot(at(2, "先把家当"), "008", cell(1)),
        spot(at(2, "租一套"), "008", cell(2)),
        spot(at(3, "挂个门牌"), "008", cell(3)),
        spot(at(3, "再把房门"), "008", cell(4)),
        spot(at(3, "通水"), "008", cell(5)),
        spot(at(5, "仓库里的家当"), "008", cell(6)),
        spot(at(5, "请个管家"), "008", cell(7)),
        spot(at(5, "门口挂"), "008", cell(8)),
        spot(at(5, "给大门"), "008", cell(9)),
        spot(at(5, "网站有更新"), "008", cell(10)),
        full(at(6), "008"),
        zoom(at(7, "先打包"), "008", cell(1)),
    ],
    "e1_step1_check": [
        full(at(0), "009"),
        full(at(1), "010"),
        full(at(3), "011"),
    ],
    "e1_step1_push": [
        full(at(0), "012"),
        zoom(at(0, "版本控制"), "013", rb("013", 0), click=True),
        zoom(at(0, "去连接"), "013", rb("013", 1), click=True, cursor=[0.865, 0.40]),
        zoom(at(3, "有未推送"), "014", [0.55, 0.28, 0.4, 0.2]),
        zoom(at(3, "点「Push」"), "014", rb("014", 0), click=True),
        zoom(at(3, "再点一次"), "015", [0.5, 0.6, 0.43, 0.22], click=True),
        zoom(at(5, "历史记录"), "014", [0.05, 0.5, 0.92, 0.48]),
    ],
    "e1_step2_server": [
        full(at(0), "016"),
        zoom(at(1, "轻量应用服务器"), "016", rb("016", 0)),
        zoom(at(1, "基础配置"), "016", rb("016", 5)),
        zoom(at(2, "宝塔"), "016", rb("016", 2)),
        zoom(at(2, "地域"), "016", rb("016", 4)),
        zoom(at(4, "自动续费"), "016", [0.02, 0.9, 0.25, 0.08]),
    ],
    "e2_dns_concept": [
        full(at(0), "018"),
        zoom(at(1, "IP"), "018", [0.033, 0.34, 0.24, 0.19]),
        zoom(at(3, "域名"), "018", [0.27, 0.34, 0.23, 0.19]),
        full(at(4, "浏览器"), "018"),
        zoom(at(5, "对暗号"), "018", [0.033, 0.55, 0.46, 0.31]),
        zoom(at(5, "翻一下本子"), "018", [0.5, 0.45, 0.25, 0.52]),
        zoom(at(6), "018", [0.033, 0.86, 0.46, 0.11]),
        full(at(7), "018"),
    ],
    "e2_dns_steps": [
        full(at(0), "019"),
        spot(at(0, "第一步"), "019", DNS3[0]),
        zoom(at(0, "工作台"), "021", rb("021", 3), click=True),
        spot(at(1, "第二步"), "019", DNS3[1]),
        zoom(at(1, "公网权威解析"), "023", rb("023", 2), click=True),
        zoom(at(1, "添加域名"), "023", rb("023", 1), click=True),
        zoom(at(1, "备案好的域名"), "024", rb("024", 0)),
        spot(at(3, "第三步"), "019", DNS3[2]),
        full(at(3, "解析设置"), "028"),
        zoom(at(3, "添加记录"), "028", rb("028", 1), click=True),
        zoom(at(4, "记录类型"), "029", rb("029", 0)),
        zoom(at(4, "记录值"), "029", rb("029", 1)),
        zoom(at(6), "030", rb("030", 0)),
        zoom(at(6, "添加并继续"), "029", rb("029", 2), click=True),
        zoom(at(6, "再加一条"), "031", rb("031", 0)),
        zoom(at(7), "032", rb("032", 1)),
        full(at(8), "032"),
    ],
    "e2_dns_verify": [
        {"at": at(0), "code": {"title": "电脑终端", "lines": [
            {"cmd": "nslookup bookdot.cn", "note": "问问 DNS：这个门牌指向哪？", "at": at(1, "nslookup")}],
            "result": {"lines": ["Name:    bookdot.cn", "Address: 47.98.xx.xx"], "ok": "返回的是服务器 IP —— 门牌已经认路了", "at": at(1, "只要返回")}}},
    ],
    "e2_port_concept": [
        full(at(0), "033"),
        full(at(1, "每扇门"), "038"),
        spot(at(2, "80 和 443"), "038", [0.02, 0.13, 0.96, 0.2]),
        spot(at(2, "22 是后门"), "038", [0.02, 0.33, 0.96, 0.18]),
        spot(at(3), "038", [0.02, 0.13, 0.96, 0.2]),
    ],
    "e2_port_steps": [
        full(at(0), "034"),
        zoom(at(0, "轻量应用服务器"), "035", rb("035", 3), click=True),
        zoom(at(0, "查看详情"), "036", rb("036", 2), click=True),
        zoom(at(1, "防火墙"), "037", rb("037", 1), click=True),
        zoom(at(1, "默认已经开了"), "037", rb("037", 2)),
        zoom(at(2, "一串零"), "040", [0.46, 0.2, 0.14, 0.45]),
    ],
    "e2_port_rules": [
        zoom(at(0), "040", [0.0, 0.7, 1.0, 0.27]),
        zoom(at(1, "修改"), "040", [0.6, 0.62, 0.08, 0.24], click=True),
        zoom(at(1, "电脑的 IP"), "040", [0.47, 0.62, 0.13, 0.26]),
        zoom(at(3, "我的公网 IP"), "041", rb("041", 0)),
        zoom(at(3, "IPv4"), "041", rb("041", 1)),
        zoom(at(4, "添加规则"), "042", rb("042", 0), click=True),
        zoom(at(4, "TCP"), "043", [0.0, 0.25, 1.0, 0.36]),
        zoom(at(4, "宝塔面板的门"), "044", rb("044", 0)),
        spot(at(6), "044", [0.0, 0.42, 1.0, 0.58]),
        full(at(6, "记住一句话"), "044"),
    ],
    "e2_baota_login": [
        full(at(0), "045"),
        zoom(at(1, "应用详情"), "047", rb("047", 0), click=True),
        zoom(at(1, "打开网站页面"), "047", rb("047", 1)),
        zoom(at(3, "执行命令"), "048", rb("048", 0)),
        full(at(3, "复制过去登录"), "049"),
        full(at(3, "先跳过"), "050"),
    ],
    "e2_nginx": [
        full(at(0), "051"),
        zoom(at(1, "网站"), "052", rb("052", 0), click=True),
        zoom(at(1, "安装 Nginx"), "052", rb("052", 1), click=True),
        zoom(at(3, "软件商店"), "053", rb("053", 3), click=True),
        zoom(at(3, "运行环境里"), "053", rb("053", 1)),
        zoom(at(3, "极速安装"), "053", rb("053", 2)),
    ],
    "e3_clone_url": [
        zoom(at(0), "008", cell(6)),
        full(at(2), "054"),
        zoom(at(2, "Code"), "056", rb("056", 1), click=True),
        zoom(at(2, "HTTPS 地址"), "056", rb("056", 2)),
    ],
    "e3_clone_cmds": [
        full(at(0), "057"),
        zoom(at(1, "终端"), "058", rb("058", 0), click=True),
        {"at": at(2), "code": {"title": "宝塔终端", "lines": [
            {"cmd": "mkdir -p /www/wwwroot && cd /www/wwwroot", "note": "进到放网站的房间", "at": at(2, "放网站的房间")},
            {"cmd": "git clone https://github.com/你的用户名/你的仓库名.git my-site", "note": "搬运工去 GitHub 拉货", "at": at(2, "让搬运工"), "mark": at(4, "git clone")},
            {"cmd": "cd my-site", "note": "进到新房子里", "at": at(2, "拉回来")},
            {"cmd": "corepack enable --install-directory /usr/local/bin", "note": "叫来装修队（启用 pnpm）", "at": at(2, "然后叫装修队")},
            {"cmd": "pnpm install", "note": "装家具配件（装依赖）", "at": at(2, "把需要的零件")},
            {"cmd": "pnpm run build", "note": "精装修（打包构建）", "at": at(2, "最后按图纸")}]}},
    ],
    "e3_build_ok": [
        full(at(0), "059"),
        zoom(at(1, "Build"), "059", rb("059", 0)),
        full(at(3), "059"),
    ],
    "e3_pm2": [
        full(at(0), "060"),
        {"at": at(2), "code": {"title": "宝塔终端", "lines": [
            {"cmd": "cd /www/wwwroot/my-site", "note": "走进网站目录", "at": at(2)},
            {"cmd": "PORT=5000 pm2 start npm --name bookdot-cn -- start", "note": "管家在 5000 号房上岗，起名 bookdot-cn", "at": at(2, "让管家")},
            {"cmd": "pm2 save", "note": "记住班表，重启也不怕", "at": at(2, "再让它记住")},
            {"cmd": "curl -I http://127.0.0.1:5000", "note": "喊一声，管家在不在", "at": at(2, "最后喊一声")}]}},
        zoom(at(4, "online"), "061", rb("061", 1)),
        zoom(at(4, "二百"), "061", rb("061", 2)),
    ],
    "e3_site": [
        full(at(0), "062"),
        full(at(1, "接待台"), "063"),
        zoom(at(2, "网站"), "064", rb("064", 1), click=True),
        zoom(at(2, "添加站点"), "064", rb("064", 2), click=True),
        zoom(at(2, "域名填进去"), "065", rb("065", 2)),
        zoom(at(2, "提交"), "065", rb("065", 3), click=True),
    ],
    "e3_proxy": [
        full(at(0), "062"),
        full(at(1), "067"),
        zoom(at(2, "设置"), "068", rb("068", 0), click=True),
        zoom(at(2, "找到「反向代理」"), "069", rb("069", 1), click=True),
        zoom(at(2, "点「添加反向代理」"), "069", rb("069", 0), click=True),
        full(at(2, "打开代理"), "070"),
        zoom(at(2, "目标地址"), "070", rb("070", 0)),
        zoom(at(2, "确定"), "070", rb("070", 1), click=True),
        zoom(at(3), "071", [0.36, 0.45, 0.22, 0.4]),
    ],
    "e3_test": [
        full(at(0), "072"),
        {"at": at(1, "curl"), "code": {"title": "宝塔终端", "lines": [
            {"cmd": "curl -I http://bookdot.cn", "note": "从外面敲一下大门", "at": at(1, "curl")}],
            "result": {"lines": ["HTTP/1.1 200 OK", "Server: nginx"], "ok": "200 OK —— 通路了", "at": at(1, "二百")}}},
        {"at": at(2), "status": [
            {"code": "200", "text": "一切正常", "at": at(2)},
            {"code": "404", "text": "地址找错了", "at": at(3, "四零四")},
            {"code": "502", "text": "端口没开，或管家挂了", "at": at(3, "五零二")},
            {"code": "500", "text": "网站代码报错", "at": at(3, "五零零")}]},
    ],
    "e4_ssl": [
        full(at(0), "074"),
        spot(at(1, "大门还没上锁"), "074", [0.34, 0.27, 0.32, 0.7]),
        zoom(at(3, "设置"), "076", rb("076", 2), click=True),
        zoom(at(3, "Let's"), "076", rb("076", 0), click=True),
        zoom(at(3, "申请证书"), "076", rb("076", 1), click=True),
        zoom(at(4, "文件验证"), "077", rb("077", 0)),
        zoom(at(4, "申请证书"), "077", rb("077", 1), click=True),
        spot(at(6, "门牌得挂稳"), "008", cell(3)),
        spot(at(6, "80 号门"), "008", cell(4)),
    ],
    "e4_force": [
        full(at(0), "078"),
        full(at(1, "强制 HTTPS"), "079"),
        zoom(at(2, "当前证书"), "080", rb("080", 0), click=True),
        zoom(at(2, "打开「强制"), "080", rb("080", 1), click=True),
        {"at": at(2, "浏览器"), "browser": "bookdot.cn"},
        zoom(at(4), "078", rb("078", 0)),
    ],
    "e4_remind": [
        full(at(0), "081"),
        zoom(at(1, "到期提醒设置"), "082", rb("082", 0), click=True),
        zoom(at(1, "提前几天"), "083", rb("083", 1)),
        zoom(at(1, "通知方式选飞书"), "083", rb("083", 2)),
        zoom(at(3, "建一个群"), "084", rb("084", 0), click=True),
        zoom(at(3, "进群设置"), "085", rb("085", 1), click=True),
        zoom(at(3, "群机器人"), "086", rb("086", 0), click=True),
        zoom(at(3, "添加一个"), "087", rb("087", 0), click=True),
        zoom(at(3, "自定义机器人"), "088", rb("088", 0), click=True),
        zoom(at(3, "默认的就行"), "089", rb("089", 0)),
        zoom(at(3, "点「添加」"), "089", rb("089", 1), click=True),
        zoom(at(4, "通知方式选上"), "091", rb("091", 1)),
        full(at(4, "收到提醒"), "090"),
    ],
    "e4_update": [
        full(at(0), "092"),
        spot(at(1, "推到 GitHub"), "092", UPD[1]),
        {"at": at(1, "在宝塔终端里"), "code": {"title": "宝塔终端", "lines": [
            {"cmd": "cd /www/wwwroot/my-site", "note": "进到网站目录", "at": at(1, "在宝塔终端里")},
            {"cmd": "git pull", "note": "搬运工把新家当拉回来", "at": at(1, "让搬运工")},
            {"cmd": "pnpm install", "note": "装修队补齐新零件", "at": at(1, "让装修队")},
            {"cmd": "pnpm run build", "note": "按新图纸重新装修", "at": at(1, "按新图纸")},
            {"cmd": "pm2 restart bookdot-cn --update-env", "note": "新管家接班", "at": at(1, "最后请")}]}},
        spot(at(3, "刷新"), "092", UPD[5]),
    ],
    "e4_recap_all": [
        full(at(0), "093"),
        spot(at(1, "家当进仓库"), "093", cell(1)),
        spot(at(1, "租房子"), "093", cell(2)),
        spot(at(1, "挂门牌"), "093", cell(3)),
        spot(at(1, "开房门"), "093", cell(4)),
        spot(at(1, "通水电"), "093", cell(5)),
        spot(at(1, "搬家当"), "093", cell(6)),
        spot(at(1, "请管家"), "093", cell(7)),
        spot(at(1, "挂引路牌"), "093", cell(8)),
        spot(at(1, "装防盗锁"), "093", cell(9)),
        spot(at(1, "再搬一次"), "093", cell(10)),
        full(at(2), "093"),
    ],
    "e4_outro": [
        {"at": at(0), "card": True},
    ],
}

# 右上角 10 步进度条：每个镜头属于第几步
STEP = {"e1_step1_check": 1, "e1_step1_push": 1, "e1_step2_server": 2,
        "e2_dns_concept": 3, "e2_dns_steps": 3, "e2_dns_verify": 3,
        "e2_port_concept": 4, "e2_port_steps": 4, "e2_port_rules": 4,
        "e2_baota_login": 5, "e2_nginx": 5,
        "e3_clone_url": 6, "e3_clone_cmds": 6, "e3_build_ok": 6, "e3_pm2": 7,
        "e3_site": 8, "e3_proxy": 8, "e3_test": 8,
        "e4_ssl": 9, "e4_force": 9, "e4_remind": 9, "e4_update": 10}
NAMES = ["云仓库", "云上房子", "挂门牌", "开房门", "通水电", "搬家当", "请管家", "引路牌", "防盗锁", "后续更新"]

write_shots(__file__, SHOTS, step_of_scene=STEP, step_names=NAMES)
