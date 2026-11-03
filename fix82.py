import re
p='src/features/mc/mc.test.tsx'
s=open(p,encoding='utf-8').read()
s=s.replace("expect(screen.getByText('Event')).toBeInTheDocument()\n    expect(screen.getByText('Next event')).toBeInTheDocument()","// \"Next event\" is also the name of a control, so look at the rows of the sheet\n    const sheet = screen.getByLabelText('Back numbers').parentElement!\n    expect(within(sheet).getByText('Event')).toBeInTheDocument()\n    expect(within(sheet).getByText('Next event')).toBeInTheDocument()",1)
s=re.sub(r"    expect\(screen\.getByText\(/\^\(SELECT[^\n]*\n","    expect(screen.getByLabelText('What to do')).toHaveTextContent(/^(Select\d+|Final)(Heat \d+)?$/)\n",s,count=1)
open(p,'w',encoding='utf-8').write(s)
