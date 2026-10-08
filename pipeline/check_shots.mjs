// 校验：每个画面（含代码面板逐行、状态码逐项）的关键词都真的出现在对应台词里
import fs from 'fs';
// 用法：node pipeline/check_shots.mjs <文章目录>
const dir = process.argv[2];
const props = JSON.parse(fs.readFileSync(`${dir}/build/props.json`, 'utf8'));
const tl = props.timeline, SHOTS = props.shots;
let bad = 0, n = 0;
const ats = (o, out = []) => {
  if (Array.isArray(o)) o.forEach((x) => ats(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) (k === 'at' || k === 'mark') ? out.push(v) : ats(v, out);
  return out;
};
for (const sc of tl.scenes) {
  for (const a of ats(SHOTS[sc.id] || [])) {
    n++;
    const line = sc.lines[a.line];
    if (!line) { console.log(`✗ ${sc.id} 第${a.line}句不存在`); bad++; continue; }
    if (a.kw && line.text.indexOf(a.kw) < 0) { console.log(`✗ ${sc.id} 第${a.line}句找不到「${a.kw}」：${line.text}`); bad++; }
  }
  if (!SHOTS[sc.id]) { console.log(`✗ ${sc.id} 没有画面安排`); bad++; }  // props 里已排除剪掉的镜头
}
console.log(bad ? `\n${bad} 处有问题（共 ${n} 个触发点）` : `全部 ${n} 个触发点匹配`);
process.exit(bad ? 1 : 0);
