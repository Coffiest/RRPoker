"use client"

import { useEffect,useState } from "react"
import { useParams } from "next/navigation"
import { FiMenu,FiX } from "react-icons/fi"
import { auth,db } from "@/lib/firebase"
import {
doc,
getDoc,
updateDoc,
onSnapshot
} from "firebase/firestore"

interface BlindLevel{
id:number
smallBlind:number
bigBlind:number
ante:number
duration:number
}

export default function TimerClient(){

const params=useParams()
const tournamentId=params.tournamentId as string

const [storeId,setStoreId]=useState<string|null>(null)

const [isMenuOpen,setIsMenuOpen]=useState(false)
const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
const [presetName, setPresetName] = useState("");
const [presetLevels, setPresetLevels] = useState<BlindLevel[]>([{ id: 1, smallBlind: 100, bigBlind: 200, ante: 0, duration: 20 }]);

const [currentLevelIndex,setCurrentLevelIndex]=useState(0)
const [timeRemaining,setTimeRemaining]=useState(1200)
const [isRunning,setIsRunning]=useState(false)

const [tournamentName,setTournamentName]=useState("")

const [entry,setEntry]=useState(0)
const [reentry,setReentry]=useState(0)
const [addon,setAddon]=useState(0)
const [bust,setBust]=useState(0)

const [entryStack,setEntryStack]=useState(0)
const [reentryStack,setReentryStack]=useState(0)
const [addonStack,setAddonStack]=useState(0)

const [prizePool,setPrizePool]=useState<Record<string,number>>({
"1":0,
"2":0,
"3":0,
"4":0,
"5":0,
"6":0
})

const blindLevels:BlindLevel[]=[
{id:1,smallBlind:15,bigBlind:30,ante:30,duration:20},
{id:2,smallBlind:20,bigBlind:40,ante:40,duration:20},
{id:3,smallBlind:25,bigBlind:50,ante:50,duration:20},
{id:4,smallBlind:30,bigBlind:60,ante:60,duration:20},
{id:5,smallBlind:40,bigBlind:80,ante:80,duration:20},
{id:6,smallBlind:50,bigBlind:100,ante:100,duration:20},
{id:7,smallBlind:75,bigBlind:150,ante:150,duration:20},
{id:8,smallBlind:100,bigBlind:200,ante:200,duration:20},
]

useEffect(()=>{

const unsub=auth.onAuthStateChanged(async(user)=>{

if(!user) return

const snap=await getDoc(doc(db,"users",user.uid))
setStoreId(snap.data()?.storeId ?? null)

})

return ()=>unsub()

},[])

useEffect(()=>{

if(!storeId) return

const ref=doc(db,"stores",storeId,"tournaments",tournamentId)

const unsub=onSnapshot(ref,(snap)=>{

const d=snap.data()
if(!d) return

setTournamentName(d.name ?? "")

setEntry(d.totalEntry ?? 0)
setReentry(d.totalReentry ?? 0)
setAddon(d.totalAddon ?? 0)
setBust(d.bustCount ?? 0)

setEntryStack(d.entryStack ?? 0)
setReentryStack(d.reentryStack ?? 0)
setAddonStack(d.addonStack ?? 0)

setPrizePool(d.prizePool ?? prizePool)

})

return ()=>unsub()

},[storeId,tournamentId])

const updatePrize=async(place:string,value:number)=>{

if(!storeId) return

const ref=doc(db,"stores",storeId,"tournaments",tournamentId)

await updateDoc(ref,{
[`prizePool.${place}`]:value
})

}

const totalPlayers=entry+reentry
const alivePlayers=totalPlayers-bust

const totalChips=
entry*entryStack+
reentry*reentryStack+
addon*addonStack

const averageStack=
alivePlayers>0
?Math.floor(totalChips/alivePlayers)
:0

useEffect(()=>{

if(!isRunning) return

const interval=setInterval(()=>{

setTimeRemaining(prev=>{

if(prev<=1){

if(currentLevelIndex<blindLevels.length-1){

const next=currentLevelIndex+1
setCurrentLevelIndex(next)

return blindLevels[next].duration*60

}

setIsRunning(false)
return 0

}

return prev-1

})

},1000)

return ()=>clearInterval(interval)

},[isRunning,currentLevelIndex])

const level=blindLevels[currentLevelIndex]

const nextLevel=
currentLevelIndex<blindLevels.length-1
?blindLevels[currentLevelIndex+1]
:level

const minutes=Math.floor(timeRemaining/60)
const seconds=timeRemaining%60

const totalPrize=
Object.values(prizePool).reduce((a,b)=>a+b,0)

return(

<main className="min-h-screen bg-[#FFFBF5] overflow-hidden relative">

<style>{`
.side-menu{
position:fixed;
top:0;
left:0;
bottom:0;
width:360px;
background:#fff;
box-shadow:4px 0 24px rgba(0,0,0,0.08);
transform:translateX(-100%);
transition:transform .3s cubic-bezier(.4,0,.2,1);
z-index:100;
}
.side-menu.open{
transform:translateX(0);
}
.overlay{
position:fixed;
inset:0;
background:rgba(0,0,0,.2);
opacity:0;
pointer-events:none;
transition:opacity .3s ease;
z-index:99;
}
.overlay.open{
opacity:1;
pointer-events:auto;
}
.menu-btn{
background:rgba(255,255,255,.6);
backdrop-filter:blur(10px);
border:none;
border-radius:8px;
padding:10px;
box-shadow:0 1px 3px rgba(0,0,0,.05);
}
`}</style>

<div
className={`overlay ${isMenuOpen?'open':''}`}
onClick={()=>setIsMenuOpen(false)}
/>

<div className={`side-menu ${isMenuOpen?'open':''}`}>

<div className="p-6 border-b border-gray-100 flex justify-between items-center">

<h2 className="text-[16px] font-semibold text-gray-900">
ブラインド設定
</h2>

<button
onClick={()=>setIsMenuOpen(false)}
className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-50"
>

<FiX className="text-[18px] text-gray-500"/>

</button>

</div>

<div className="p-6">
    <button
      className="w-full py-2 px-4 bg-[#F2A900] text-white rounded-lg font-semibold hover:bg-[#e2a000] transition mb-4"
      onClick={() => setIsPresetModalOpen(true)}
    >
      ＋プリセットを作成
    </button>
</div>

</div>

<div className="absolute top-5 left-5 z-10">

<button
onClick={()=>setIsMenuOpen(true)}
className="menu-btn"
>

<FiMenu className="text-[18px] text-gray-600"/>

</button>

</div>

<div className="flex h-screen">

<div className="flex-1 flex flex-col items-center justify-center px-20 py-12">

<div className="w-full max-w-5xl">

<div className="text-center mb-8">

<h1 className="text-[22px] font-medium text-gray-800">
{tournamentName}
</h1>

</div>

<div className="text-center mb-6">

<div className="flex items-baseline justify-center gap-2">

<span className="text-[56px] font-light text-gray-900">
{level.smallBlind}
</span>

<span className="text-[40px] text-gray-400">/</span>

<span className="text-[56px] font-light text-gray-900">
{level.bigBlind}
</span>

<span className="text-[36px] text-gray-500 ml-1">
({level.ante})
</span>

</div>

</div>

<div className="text-center mb-6">

<div className="flex items-baseline justify-center gap-2">

<span className="text-[200px] font-light text-[#F2A900] tabular-nums">
{minutes.toString().padStart(2,"0")}
</span>

<span className="text-[140px] text-[#F2A900]">:</span>

<span className="text-[200px] font-light text-[#F2A900] tabular-nums">
{seconds.toString().padStart(2,"0")}
</span>

</div>

</div>

<div className="text-center mb-12 text-[18px] text-gray-600">

<span className="font-medium">Next:</span>{" "}
{nextLevel.smallBlind}
<span className="text-gray-400"> / </span>
{nextLevel.bigBlind}
<span className="text-gray-500"> ({nextLevel.ante})</span>

</div>

<div className="flex items-center justify-center gap-12 text-[16px] text-gray-700">

<div>

<span className="text-gray-500">Players </span>

<span className="font-medium">
{alivePlayers}/{totalPlayers}
</span>

</div>

<span className="text-gray-300">|</span>

<div>

<span className="text-gray-500">Ave: </span>

<span className="font-medium">
{averageStack.toLocaleString()}
</span>

</div>

<span className="text-gray-300">|</span>

<div>

<span className="text-gray-500">Add-on: </span>

<span className="font-medium">
{addon}
</span>

</div>

</div>

</div>

</div>

<div className="w-1/5 min-w-[240px] p-8 flex flex-col justify-center border-l border-gray-200/60">

<h2 className="text-[14px] font-medium text-gray-500 mb-6 uppercase tracking-wide">
Prize Pool
</h2>

<div className="space-y-3">

{Object.entries(prizePool).map(([place,amount])=>(

<div
key={place}
className="flex items-center justify-between py-2"
>

<span className="text-[15px] text-gray-600">
{place}th
</span>

<input
type="number"
value={amount}
onChange={(e)=>updatePrize(place,Number(e.target.value))}
className="w-28 text-right text-[17px] font-medium text-gray-900 border border-gray-200 rounded px-2 py-1"
/>

</div>

))}

</div>

<div className="mt-6 pt-4 border-t border-gray-200">

<div className="flex justify-between">

<span className="text-[13px] font-medium text-gray-500 uppercase">
Total
</span>

<span className="text-[19px] font-semibold text-[#F2A900]">

¥{totalPrize.toLocaleString()}

</span>

</div>

</div>

</div>

</div>

</main>

)
}