"""这篇文章的画面安排：说到哪句话时，画面怎么动。写法见 docs/SHOTS_GUIDE.md，工具函数见 pipeline/shotlib.py。
用法：./a2v shots <文章目录>
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "pipeline"))
from shotlib import *  # noqa: E402,F401,F403

RB = load_redboxes(__file__)


def rb(img, i):  # 截图上作者标注的第 i 个红框：rb("029", 0)
    import shotlib
    return shotlib.rb(RB, img, i)


SHOTS = {
    # "镜头id": [
    #     full(at(0), "001", pop=True),
    #     zoom(at(2, "添加记录"), "028", rb("028", 1), click=True),
    #     spot(at(3, "第一步"), "019", cols(3, 0.02, 0.99, 0.13, 0.9)[0]),
    # ],
    # 最后一个镜头： "outro": [card(at(0))],
}

STEP = {}    # 教程类：{"镜头id": 第几步}；不需要步骤条就留空
NAMES = []   # 步骤名：["第一步名", ...]

write_shots(__file__, SHOTS, step_of_scene=STEP, step_names=NAMES)
