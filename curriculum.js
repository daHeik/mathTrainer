/* Eigene, variierte Aufgaben zu den fotografierten Lernzielen. Keine Buchbilder. */
(function(root){
  'use strict';
  var chapters = {
    terms:{label:'Fachbegriffe',types:['roles','operation','result','translate']},
    multiply:{label:'Halbschriftlich multiplizieren',types:['split','shortcut','tens','double','star','starGap']},
    divide:{label:'Halbschriftlich dividieren',types:['tens','inverse','relation']},
    rest:{label:'Dividieren mit Rest',types:['division','proof','baskets','divisors','prime','multiple','digitRest']},
    numbers:{label:'Zahlenraum bis 10.000',types:['place','decompose','bundle','digits','counters','move','crossSum','word','writeWord','line','neighbor','previous','next','sequence','sequenceRule','blocks']},
    stories:{label:'Sachaufgaben',types:['multiply','divide','rest','roundUp','twoStep','question','money']}
  };
  function number(a,b){return a+Math.floor(Math.random()*(b-a+1));}
  function pick(a){return a[number(0,a.length-1)];}
  function digitSum(n){return String(n).split('').reduce(function(s,d){return s+Number(d);},0);}
  function word(n){
    var small=['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
    if(n<20)return small[n];
    if(n<100)return (n%10?(n%10===1?'ein':small[n%10])+'und':'')+['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'][Math.floor(n/10)];
    if(n<1000)return (Math.floor(n/100)===1?'ein':small[Math.floor(n/100)])+'hundert'+(n%100?word(n%100):'');
    return (Math.floor(n/1000)===1?'ein':word(Math.floor(n/1000)))+'tausend'+(n%1000?word(n%1000):'');
  }
  function keys(chapter){return chapters[chapter].types.map(function(type){return 'k:'+chapter+':'+type;});}
  // Keep retired records for earned rewards and existing backups, never schedule them.
  var retiredKeys = ['k:stories:units'];
  function allKeys(){return Object.keys(chapters).reduce(function(a,c){return a.concat(keys(c));},[]).concat(retiredKeys);}
  function question(chapter,type){
    if(!chapters[chapter] || chapters[chapter].types.indexOf(type) === -1)return null;
    var a=number(2,9),b=number(12,99),n=number(1000,9999),d=number(2,10),q=number(12,99),r=number(0,d-1);
    var prompt='',fields=[],explanation='',visual=null;
    function field(label,value,options){fields.push({label:label,value:String(value),options:options});}
    function numeric(label,value){field(label,value);}
    if(chapter==='terms'){
      var ops=['Addition','Subtraktion','Multiplikation','Division'],results=['Summe','Differenz','Produkt','Quotient'],i=number(0,3),sign=['+','−','·',':'][i];
      if(type==='roles'){
        var roles=[['1. Summand','2. Summand'],['Minuend','Subtrahend'],['1. Faktor','2. Faktor'],['Dividend','Divisor']];
        var pos=number(0,1);prompt='Wie heißt die '+(pos===0?'erste':'zweite')+' Zahl bei '+(i===3?a*b:a+b)+' '+sign+' '+a+'?';
        field('Fachbegriff',roles[i][pos],['1. Summand','2. Summand','Minuend','Subtrahend','1. Faktor','2. Faktor','Dividend','Divisor']);
        explanation=roles[i].join(' '+sign+' ')+' = '+results[i]+'.';
      }else if(type==='operation'){prompt='Wie heißt die Rechenart mit dem Zeichen '+sign+'?';field('Rechenart',ops[i],ops);}
      else if(type==='result'){prompt='Wie heißt das Ergebnis einer '+ops[i]+'?';field('Ergebnisname',results[i],results);}
      else{prompt='Berechne die Differenz aus '+n+' und '+b+'.';numeric('Differenz',n-b);explanation=n+' − '+b+' = '+(n-b)+'.';}
    }else if(chapter==='multiply'){
      if(type==='split'){
        b=pick([number(12,99),number(102,110)]);prompt=a+' · '+b+' – Zerlege die zweite Zahl nach Stellenwerten.';
        [100,10,1].forEach(function(p){var part=Math.floor(b/p)%10*p;if(part)numeric(a+' · '+part,a*part);});numeric('Summe der Teilergebnisse',a*b);
        explanation='Multipliziere jeden Stellenwertanteil und addiere die Teilergebnisse.';
      }else if(type==='shortcut'){
        b=number(2,10)*10-1;prompt=a+' · '+b+' – Rechne mit der nächsten Zehnerzahl und ziehe das Zuviel ab.';
        numeric(a+' · '+(b+1),a*(b+1));numeric('Davon abziehen',a);numeric('Ergebnis',a*b);explanation=a+' · '+(b+1)+' − '+a+' = '+a*b+'.';
      }else if(type==='tens'){b=number(1,99);prompt=b+' · 10';numeric('Ergebnis',b*10);}
      else if(type==='double'){a=pick([2,4,6,8]);prompt=a+' · '+b+' = '+a/2+' · ?';numeric('Fehlender Faktor',b*2);explanation='Ein Faktor halbiert, der andere verdoppelt: Das Produkt bleibt gleich.';}
      else {b=number(2,9)*10;var c=number(2,9);visual={kind:'star',a:a,b:b,c:type==='starGap'?'?':c,ab:a*b,bc:b*c,ac:a*c};
        prompt=type==='star'?'Multipliziere benachbarte Innenzahlen. Berechne die Sternensumme.':'Welche Innenzahl fehlt? Außen steht jeweils das Produkt der benachbarten Innenzahlen.';
        if(type==='star'){numeric(a+' · '+b,a*b);numeric(b+' · '+c,b*c);numeric(a+' · '+c,a*c);numeric('Sternensumme',a*b+b*c+a*c);}else numeric('Fehlende Innenzahl',c);
      }
    }else if(chapter==='divide'){
      if(type==='tens'){q=number(2,Math.floor(100/d));prompt=q*d*10+' : '+d*10;numeric('Quotient',q);explanation='Teile beide Zahlen zuerst durch 10: '+q*d+' : '+d+' = '+q+'.';}
      else if(type==='inverse'){prompt='? : 10 = '+q;numeric('Dividend',q*10);}
      else{prompt=q*d+' : '+d+' = '+q+'. Wie viel ist '+q*d*2+' : '+d+'?';numeric('Quotient',q*2);explanation='Doppelter Dividend, gleicher Divisor: doppelter Quotient.';}
    }else if(chapter==='rest'){
      n=d*q+r;
      if(type==='division'||type==='proof'){prompt=n+' : '+d+' – Gib Quotient und Rest an, auch bei Rest 0.';numeric('Quotient',q);numeric('Rest',r);if(type==='proof')numeric('Probe: '+q+' · '+d+' + '+r,n);explanation=q+' · '+d+' + '+r+' = '+n+'. Der Rest ist kleiner als '+d+'.';}
      else if(type==='baskets'){prompt='Beim Teilen durch '+d+': Wie viele verschiedene Reste sind möglich (einschließlich 0)?';numeric('Anzahl der Rest-Körbe',d);explanation='Die möglichen Reste sind 0 bis '+(d-1)+'.';}
      else if(type==='divisors'){n=number(12,50);var ds=[];for(var j=1;j<=n;j++)if(n%j===0)ds.push(j);prompt='Welche Liste enthält ALLE Teiler von '+n+'?';field('Teilerliste',ds.join(', '),[ds.join(', '),ds.slice(1).join(', '),ds.concat([n+1]).join(', '),[1,n+1].join(', ')]);explanation='Teiler teilen ohne Rest. Prüfe die Faktorpaare.';}
      else if(type==='prime'){n=pick([1,2,3,7,11,17,23,31,53,59,4,9,15,21,35,49,51]);var prime=n>=2;for(var k=2;k*k<=n;k++)if(n%k===0)prime=false;prompt='Ist '+n+' eine Primzahl?';field('Entscheidung',prime?'Ja':'Nein',['Ja','Nein']);explanation='Eine Primzahl hat genau zwei Teiler: 1 und sich selbst. 1 ist keine Primzahl.';}
      else if(type==='multiple'){n=number(2,9)*10;b=n*number(2,9);prompt='Welche Zahl ist ein Vielfaches von '+n+'?';field('Vielfaches',b,[b,b+1,b+2,b+3].map(String));}
      else{n=number(100,999);prompt='Berechne die Quersumme von '+n+' und den Rest bei '+n+' : 9.';numeric('Quersumme',digitSum(n));numeric('Rest',n%9);explanation='Zahl und Quersumme haben beim Teilen durch 9 denselben Rest.';}
    }else if(chapter==='numbers'){
      var digits=String(n).split('').map(Number),p=pick([1,10,100,1000]),labels={1:'Einer',10:'Zehner',100:'Hunderter',1000:'Tausender'};
      if(type==='place'){prompt=digits[0]+' T + '+digits[1]+' H + '+digits[2]+' Z + '+digits[3]+' E';numeric('Zahl',n);}
      else if(type==='decompose'){prompt='Zerlege '+n+' in die Stellenwerttafel.';['Tausender','Hunderter','Zehner','Einer'].forEach(function(s,i){numeric(s,digits[i]);});}
      else if(type==='bundle'){a=number(1,8);b=number(10,19);prompt=a+' T + '+b+' H – Bündle und gib die Zahl an.';numeric('Zahl',a*1000+b*100);explanation='10 Hunderter sind 1 Tausender.';}
      else if(type==='digits'){digits=digits.map(function(v){return v||1;});prompt='Bilde mit allen Ziffern '+digits.join(', ')+' die kleinste und die größte Zahl.';digits.sort();numeric('Kleinste Zahl',Number(digits.join('')));numeric('Größte Zahl',Number(digits.reverse().join('')));}
      else if(type==='counters'||type==='blocks'){visual={kind:type,digits:digits};prompt=type==='counters'?'Lies die Plättchen in der Stellenwerttafel.':'Lies die Stellenwerte: Blöcke = 1000, Platten = 100, Stangen = 10, Würfel = 1.';numeric('Zahl',n);}
      else if(type==='move'){digits=digits.map(function(v){return Math.max(1,Math.min(8,v));});n=Number(digits.join(''));visual={kind:'counters',digits:digits};prompt='Nimm ein Plättchen bei den Tausendern weg und lege eines bei den Zehnern dazu.';numeric('Neue Zahl',n-1000+10);numeric('Neue Quersumme',digitSum(n-990));explanation='Der Wert sinkt um 990. Die Quersumme bleibt gleich.';}
      else if(type==='crossSum'){digits=[number(1,8),number(1,8),number(1,7),number(3,9)];n=Number(digits.join(''));visual={kind:'counters',digits:digits};prompt='Nimm drei Einer-Plättchen weg und lege zwei Zehner-Plättchen dazu.';numeric('Neue Zahl',n+17);numeric('Neue Quersumme',digitSum(n)-1);explanation='Die Zahl steigt um 17; die Quersumme sinkt um 1.';}
      else if(type==='word'){prompt='Schreibe als Zahl: '+word(n);numeric('Zahl',n);}
      else if(type==='writeWord'){prompt='Welches Zahlwort gehört zu '+n+'?';field('Zahlwort',word(n),[n,n+1,n-1,n===9999?n-10:n+10].map(word));}
      else if(type==='line'){var step=pick([1,10,100]),start=number(0,Math.floor((10000-step*10)/(step*10)))*step*10,index=number(1,9);visual={kind:'line',start:start,step:step,index:index};prompt='Welche Zahl markiert der Pfeil am Zahlenstrahl?';numeric('Zahl',start+index*step);}
      else if(type==='neighbor'){n=number(1,9999);if(n%p===0)n=Math.min(9999,n+1);if(p===1)p=10;prompt='Gib die benachbarten '+labels[p]+' von '+n+' an.';numeric('Kleinerer Nachbar',Math.floor((n-1)/p)*p);numeric('Größerer Nachbar',(Math.floor(n/p)+1)*p);}
      else if(type==='previous'||type==='next'){n=pick([number(1,9999),1000,3999,9999]);prompt=(type==='previous'?'Vorgänger':'Nachfolger')+' von '+n;numeric('Zahl',n+(type==='previous'?-1:1));}
      else{var stepSize=pick([25,30,50,100,125,150,200])*(Math.random()<.5?-1:1),startN=number(1000,8000);prompt='Zahlenfolge: '+[startN,startN+stepSize,startN+2*stepSize].join(', ')+', …';if(type==='sequenceRule')field('Regel',(stepSize>0?'+':'−')+Math.abs(stepSize),['+'+Math.abs(stepSize),'−'+Math.abs(stepSize),'+'+Math.abs(stepSize*2),'−'+Math.abs(stepSize*2)]);else numeric('Nächste Zahl',startN+3*stepSize);}
    }else if(chapter==='stories'){
      if(type==='multiply'){prompt=a+' Schachteln enthalten jeweils '+b+' Stifte. Wie viele Stifte sind es insgesamt?';numeric('Stifte',a*b);explanation=a+' · '+b+' = '+a*b+' Stifte.';}
      else if(type==='divide'){prompt=d*q+' kg Äpfel werden in Beutel zu je '+d+' kg gefüllt. Wie viele Beutel werden voll?';numeric('Beutel',q);explanation=d*q+' : '+d+' = '+q+' Beutel.';}
      else if(type==='rest'){r=number(1,d-1);prompt=d*q+r+' Murmeln werden gerecht auf '+d+' Kinder verteilt. Wie viele bekommt jedes Kind und wie viele bleiben übrig?';numeric('Murmeln je Kind',q);numeric('Übrige Murmeln',r);explanation='Jedes Kind bekommt '+q+' Murmeln; '+r+' bleiben übrig.';}
      else if(type==='roundUp'){r=number(1,d-1);prompt=d*q+r+' Kinder fahren mit Kleinbussen. In jeden Bus passen '+d+' Kinder. Wie viele Busse braucht die Gruppe mindestens?';numeric('Busse',q+1);explanation=q+' Busse reichen für '+d*q+' Kinder. Für die übrigen '+r+' braucht ihr einen weiteren Bus.';}
      else if(type==='twoStep'){var cost=a*b,paid=cost+number(1,9)*10;prompt=a+' Eintrittskarten kosten je '+b+' €. Die Gruppe bezahlt '+paid+' €. Wie viel Wechselgeld bekommt sie?';numeric('Gesamtpreis in €',cost);numeric('Wechselgeld in €',paid-cost);explanation='Erst multiplizieren, dann den Preis vom bezahlten Geld abziehen.';}
      else if(type==='question'){prompt='Ein Kurs mit 10 Stunden kostet '+q*10+' €. Welche Frage lässt sich mit diesen Angaben beantworten?';field('Passende Frage','Was kostet eine Stunde?',['Was kostet eine Stunde?','Wie alt ist die Kursleiterin?','Wie viele Kinder kommen?','Wie lange dauert die Fahrt?']);}
      else if(type==='money'){b=number(11,99);prompt=b+' Münzen zu je 10 Cent. Wie viele Cent sind das? Wie viele ganze Euro und übrige Cent?';numeric('Insgesamt Cent',b*10);numeric('Ganze Euro',Math.floor(b/10));numeric('Übrige Cent',b%10*10);}
    }
    if(!explanation)explanation=fields.map(function(f){return f.label+': '+f.value;}).join('; ')+'.';
    return {prompt:prompt,fields:fields,explanation:explanation,visual:visual};
  }
  root.TestCurriculum={chapters:chapters,retiredKeys:retiredKeys,keys:keys,allKeys:allKeys,question:question,word:word};
})(typeof window !== 'undefined' ? window : globalThis);
