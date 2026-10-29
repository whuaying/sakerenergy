# -*- coding: utf-8 -*-
import re, io

p = r'E:\saker-energy-main\docs\integrations\wanzhi\submission\build_docx.py'
s = io.open(p, encoding='utf-8').read()

# 1) heading calls: para(doc, 'X.X ...', 2) -> heading(doc, 'X.X ...', 2)
s, n1 = re.subn(r"para\(doc, '([^']+)', 2\)", r"heading(doc, '\1', 2)", s)

# 2) move fldSimple from run into paragraph (both add_page_field and add_toc)
s2, n2 = s.count("    run._r.append(fld)"), 0
s = s.replace("    run._r.append(fld)", "    p._p.append(fld)")
n2 = s2

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('heading fixes:', n1, '| fld fixes applied:', n2)
