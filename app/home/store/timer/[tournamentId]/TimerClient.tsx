"use client"

import { useEffect,useState } from "react"
import { useParams } from "next/navigation"
import { Menu } from "lucide-react"
import { auth,db } from "@/lib/firebase"
import {
doc,
getDoc,
setDoc,
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

const [menuOpen,setMenuOpen]=useState(false)

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

})

return ()=>unsub()

},[storeId,tournamentId])

const totalPlayers=entry+reentry
const alivePlayers=totalPlayers-bust

const totalChips=
entry*entryStack+
reentry*reentryStack+
addon*addonStack

const averageStack=
alivePlayers>0
? Math.floor(totalChips/alivePlayers)
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

return(

<div className="min-h-screen bg-gray-50">

<div className="fixed top-0 left-0 p-6 z-30">

<button
onClick={()=>setMenuOpen(true)}
className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm"
>

<Menu className="w-5 h-5 text-gray-600"/>

</button>

</div>

<div className="flex h-screen">

<div className="flex-1 flex items-center justify-center px-20">

<div className="w-full max-w-7xl">

<div className="bg-white border rounded-2xl p-12 text-center">

<h1 className="text-3xl font-semibold mb-8">

{tournamentName}

</h1>

<div className="text-8xl font-mono mb-6">

{minutes}:{seconds.toString().padStart(2,"0")}

</div>

<div className="text-2xl mb-4">

Blinds {level.smallBlind}/{level.bigBlind}

</div>

<div className="text-lg text-gray-500 mb-8">

Next {nextLevel.smallBlind}/{nextLevel.bigBlind}

</div>

<button

onClick={()=>setIsRunning(!isRunning)}

className="px-8 py-3 rounded-xl bg-gray-900 text-white"

>

{isRunning ? "Pause" : "Start"}

</button>

</div>

<div className="grid grid-cols-4 gap-6 mt-10">

<div className="bg-white border rounded-xl p-6 text-center">

Players

<div className="text-3xl font-semibold">

{alivePlayers}

</div>

</div>

<div className="bg-white border rounded-xl p-6 text-center">

Entries

<div className="text-3xl font-semibold">

{totalPlayers}

</div>

</div>

<div className="bg-white border rounded-xl p-6 text-center">

Avg Stack

<div className="text-3xl font-semibold">

{averageStack}

</div>

</div>

<div className="bg-white border rounded-xl p-6 text-center">

Addons

<div className="text-3xl font-semibold">

{addon}

</div>

</div>

</div>

</div>

</div>

</div>

</div>

)

}
