"use client"

import { useEffect,useRef,useState } from "react"
import { FiTrash2, FiEdit3 } from "react-icons/fi"
import { addDoc, collection as fsCollection } from "firebase/firestore"
import { serverTimestamp } from "firebase/firestore"
import { useParams } from "next/navigation"
import { FiMenu,FiX } from "react-icons/fi"
import { auth,db } from "@/lib/firebase"
import {
doc,
getDoc,
updateDoc,
onSnapshot,
collection,
getDocs
} from "firebase/firestore"
import { createPortal } from "react-dom"
import { deleteDoc } from "firebase/firestore"

const AudioContextClass =
  typeof window !== "undefined"
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null;

let audioCtx: AudioContext | null = null;

function getAudio() {
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }

  return audioCtx;
}

function playBeep(freq = 440, ms = 200) {
  const ctx = getAudio();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.25, ctx.currentTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + ms / 1000);
}

// Toastコンポーネント
// Toast props型明示
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#F2A900] text-white px-6 py-3 rounded shadow-lg z-[300] animate-fadein">
      {message}
      <button className="ml-4 text-white underline" onClick={onClose}>閉じる</button>
    </div>
  );
}



export default function TimerClient(){
useEffect(() => {
  const ctx = getAudio();
  if (!ctx) return;
}, []);
const [audioUnlocked, setAudioUnlocked] = useState(false);

function unlockAudio() {
  if (audioUnlocked) return;

  const ctx = getAudio();
  if (!ctx) return;

  ctx.resume();

  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  setAudioUnlocked(true);
}

const params=useParams()
const tournamentId=params.tournamentId as string

const [storeId,setStoreId]=useState<string|null>(null)

const [isMenuOpen,setIsMenuOpen]=useState(false)

const [isPresetModalOpen,setIsPresetModalOpen]=useState(false)
// プリセット作成用state
type Level = BlindLevel | BreakLevel
type BlindLevel = {
  type: "level"
  smallBlind: number | null
  bigBlind: number | null
  ante: number | null
  duration: number | null
}
type BreakLevel = {
  type: "break"
  duration: number | null
}
const [presetName,setPresetName]=useState("")
const [editingPresetId,setEditingPresetId]=useState<string|null>(null)
const [levels,setLevels]=useState<Level[]>([
  {
    type:"level",
    smallBlind:null,
    bigBlind:null,
    ante:null,
    duration:null
  }
])
const [dragIndex, setDragIndex] = useState<number | null>(null)
const [dropIndex, setDropIndex] = useState<number | null>(null)

// 有効数字2桁丸め
function roundSig2(num:number){
  return Number(num.toPrecision(2))
}

// 次レベル生成（整数・四捨五入）
function generateNextLevel(prev:BlindLevel):BlindLevel{
  const sb = Math.max(1, Math.round((prev.smallBlind??0)*1.5))
  const bb = Math.max(1, Math.round((prev.bigBlind??0)*1.5))
  return {
    type:"level",
    smallBlind: sb,
    bigBlind: bb,
    ante: bb,
    duration: prev.duration
  }
}

// ANTE自動更新（整数）
function handleBbChange(idx:number,value:number|null){
  const intVal = value !== null ? Math.max(1, Math.round(Number(value))) : null
  setLevels(levels=>levels.map((lv,i)=>{
    if(i!==idx||lv.type!=="level") return lv
    return {
      ...lv,
      bigBlind: intVal,
      ante: intVal
    }
  }))
}

// レベル追加
function addLevel(){
  const last = [...levels].reverse().find(l=>l.type==="level") as BlindLevel|undefined

  if(!last){
    setLevels([...levels,{
      type:"level",
      smallBlind:100,
      bigBlind:200,
      ante:200,
      duration:20
    }])
    return
  }

  const base:BlindLevel={
    type:"level",
    smallBlind:last.smallBlind ?? 100,
    bigBlind:last.bigBlind ?? 200,
    ante:last.bigBlind ?? 200,
    duration:last.duration ?? 20
  }

  setLevels([...levels,generateNextLevel(base)])
}

// ブレイク追加
function addBreak(){
  setLevels([...levels,{type:"break",duration:null}])
}

// 行削除
function removeLevel(idx:number){
  setLevels(levels=>levels.filter((_,i)=>i!==idx))
}

// 並び替え
function handleDragStart(idx:number){
  setDragIndex(idx)
}
function handleDragEnter(idx:number){
  setDropIndex(idx)
}
function handleDragEnd(){
  if(dragIndex===null||dropIndex===null||dragIndex===dropIndex){
    setDragIndex(null);setDropIndex(null);return
  }
  const newLv = [...levels]
  const [moved] = newLv.splice(dragIndex,1)
  newLv.splice(dropIndex,0,moved)
  setLevels(newLv)
  setDragIndex(null);setDropIndex(null)
}

// Level番号: index+1, Breakは番号なし
function getLevelNumber(idx:number){
  return idx+1
}

// プリセット保存処理
async function savePreset(){
  if(!presetName){
    alert("ブラインド名を入力してください")
    return
  }
  if(!storeId){
    alert("店舗IDが取得できません")
    return
  }
  if(editingPresetId){
    const ref = doc(db,"stores",storeId,"blindPresets",editingPresetId)
    await updateDoc(ref,{
      name:presetName,
      levels:levels
    })
  }else{
    const ref = collection(db,"stores",storeId,"blindPresets")
    await addDoc(ref,{
      name:presetName,
      levels:levels,
      createdAt:new Date()
    })
  }
  setEditingPresetId(null)
  setIsPresetModalOpen(false)
}

const [currentLevelIndex,setCurrentLevelIndex]=useState(0)
const [startTime,setStartTime]=useState<number|null>(null)
const [duration,setDuration]=useState<number>(0)
const [now,setNow]=useState(Date.now())
const [isRunning,setIsRunning]=useState(false)



const prevIsRunningRef = useRef(false)
useEffect(() => {
  const justStarted = !prevIsRunningRef.current && isRunning;

  if (justStarted && currentLevelIndex === 0 && timeRemaining > 0) {
    const audio = new Audio("/levelup.mp3");
    audio.play().catch(() => {});
  }

  prevIsRunningRef.current = isRunning;
}, [isRunning, currentLevelIndex, timeRemaining]);

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

const [blindPresets,setBlindPresets]=useState<any[]>([])
const [selectedPreset,setSelectedPreset]=useState<string>("")
const [customBlindLevels,setCustomBlindLevels]=useState<Level[]|null>(null)


async function applyPreset(preset:any){

  if(!storeId) return

 const levels = Array.isArray(preset.levels)
  ? preset.levels
  : []

  if(levels.length===0) return

 const firstDuration =
  typeof levels[0]?.duration === "number"
    ? levels[0].duration * 60
    : 0

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

await updateDoc(ref,{
  selectedPreset:preset.id,
  customBlindLevels:levels,
  currentLevelIndex:0,
  startTime: serverTimestamp(),
  duration: firstDuration,
  timerRunning: false
})

  setSelectedPreset(preset.id)
  setCustomBlindLevels(levels)
  setCurrentLevelIndex(0)


}




useEffect(()=>{

if(!storeId) return

const fetchPresets=async()=>{

const col=collection(db,"stores",storeId,"blindPresets")
const snap=await getDocs(col)

setBlindPresets(
snap.docs.map(doc=>({id:doc.id,...doc.data()}))
)

}

fetchPresets()

},[storeId,isPresetModalOpen])



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

  if (typeof d.timeRemaining === "number") {
  setTimeRemaining(d.timeRemaining)
}



  setTournamentName(d.name ?? "")
  setEntry(d.totalEntry ?? 0)
  setReentry(d.totalReentry ?? 0)
  setAddon(d.totalAddon ?? 0)
  setBust(d.bustCount ?? 0)

  setEntryStack(d.entryStack ?? 0)
  setReentryStack(d.reentryStack ?? 0)
  setAddonStack(d.addonStack ?? 0)

  setPrizePool(d.prizePool ?? {
    "1":0,"2":0,"3":0,"4":0,"5":0,"6":0
  })





if(typeof d.currentLevelIndex === "number") {
  setCurrentLevelIndex(d.currentLevelIndex)
}



if(typeof d.selectedPreset === "string"){
  setSelectedPreset(d.selectedPreset)
}

if(Array.isArray(d.customBlindLevels)){
  setCustomBlindLevels(d.customBlindLevels)
}







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

async function pauseTimer(){
  if(!storeId || !startTime) return

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const remaining = Math.max(duration - elapsed, 0)

  await updateDoc(ref,{
    duration: remaining,
    timerRunning: false
  })
}

async function resumeTimer(){
  if(!storeId) return

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

  await updateDoc(ref,{
    startTime: serverTimestamp(),
    timerRunning: true
  })
}

async function skipLevel(){
  if(!storeId) return

  const nextIndex = currentLevelIndex + 1
  const next = levelsToUse[nextIndex]

  if(!next) return

  const nextDuration =
    typeof next.duration === "number"
      ? next.duration * 60
      : 0

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

  await updateDoc(ref,{
    currentLevelIndex: nextIndex,
    startTime: serverTimestamp(),
    duration: nextDuration,
    timerRunning: true
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

const levelsToUse = Array.isArray(customBlindLevels)
  ? customBlindLevels
  : []

useEffect(()=>{
  if(!isRunning || !storeId) return;

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

  const interval = setInterval(async () => {
    const snap = await getDoc(ref)
    const d = snap.data()
    if(!d) return

    const current = d.timeRemaining ?? 0

    // 音
    if (current === 11) new Audio("/tensec.mp3").play()
    if (current === 4 || current === 3 || current === 2) {
      new Audio("/countdown.mp3").play()
    }

    if (current <= 1) {
      if (d.currentLevelIndex < levelsToUse.length - 1) {
        const next = d.currentLevelIndex + 1
        const duration = levelsToUse[next]?.duration

        await updateDoc(ref,{
          currentLevelIndex: next,
          timeRemaining: typeof duration === "number" ? duration * 60 : 0
        })

        new Audio("/levelup.mp3").play()
      } else {
        await updateDoc(ref,{
          timerRunning:false,
          timeRemaining:0
        })
      }
      return
    }

    await updateDoc(ref,{
      timeRemaining: current - 1
    })

  },1000)

  return ()=>clearInterval(interval)

},[isRunning,storeId,currentLevelIndex,levelsToUse])

const level = levelsToUse[currentLevelIndex] ?? null

const nextLevel =
  currentLevelIndex < levelsToUse.length - 1
    ? levelsToUse[currentLevelIndex + 1]
    : level

const minutes=Math.floor(timeRemaining/60)
const seconds=timeRemaining%60

const totalPrize=
Object.values(prizePool).reduce((a,b)=>a+b,0)

const isPresetSelected = levelsToUse.length > 0 && level !== null

return (
  <div onClick={unlockAudio} onTouchStart={unlockAudio}>
    <main
      className="min-h-screen bg-[#FFFBF5] overflow-hidden relative"
    >

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

<div className="mb-4">

{blindPresets.map((preset) => {
  return (
    <div key={preset.id} className="flex items-center gap-2 mb-2">
      <button
        type="button"

        className={[
  "flex-1 py-2 px-4 rounded-lg font-semibold border transition",
  "bg-white text-gray-900",
  selectedPreset === preset.id
    ? "border-[#F2A900] ring-2 ring-[#F2A900]/30"
    : "border-gray-200 hover:border-gray-300"
].join(" ")}
        
        onClick={() => applyPreset(preset)}
      >
        {preset.name}
      </button>
      <button
        type="button"
        className="h-10 w-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
        onClick={() => {
          setEditingPresetId(preset.id)
          setPresetName(preset.name)
          if(preset.levels){
            setLevels(preset.levels)
          }
          setIsPresetModalOpen(true)
        }}
      >
        <FiEdit3 className="text-[18px] text-gray-600" />
      </button>
      <button
        type="button"
        className="h-10 w-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
        onClick={async () => {
          const ok = window.confirm("このプリセットを削除しますか？")
          if (!ok) return
          if (!storeId) return
          await deleteDoc(doc(db, "stores", storeId, "blindPresets", preset.id))
          setBlindPresets((prev) => prev.filter((p) => p.id !== preset.id))
        }}
      >
        <FiTrash2 className="text-[18px] text-gray-600" />
      </button>
    </div>
  )
})}

</div>

<button
className="w-full py-2 px-4 bg-[#F2A900] text-white rounded-lg font-semibold hover:bg-[#e2a000] transition mb-4"
onClick={() => {
  console.log("open modal clicked");
  setIsPresetModalOpen(true);
}}
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

<h1 className="text-[30px] font-medium text-gray-600">
{tournamentName}
</h1>

</div>

<div className="text-center mb-6">
  <div className="flex items-baseline justify-center gap-2">

    {level?.type === "break" ? (
      <span className="text-[64px] font-semibold text-[#F2A900]">
        BREAK
      </span>
    ) : (
      <>
        <span className="text-[56px] font-light text-gray-600">
          {level?.smallBlind ?? "-"}
        </span>

        <span className="text-[56px] text-gray-600"> / </span>

        <span className="text-[56px] font-light text-gray-600">
          {level?.bigBlind ?? "-"}
        </span>

        <span className="text-[40px] text-gray-600 ml-1">
          ({level?.ante ?? "-"})
        </span>
      </>
    )}

  </div>
</div>




<div className="text-center mb-6">
  <div className="flex items-baseline justify-center gap-2">
    {isPresetSelected ? (
      <>
        <span className="text-[200px] font-light text-[#F2A900] tabular-nums">
          {minutes.toString().padStart(2,"0")}
        </span>
        <span className="text-[140px] text-[#F2A900]">:</span>
        <span className="text-[200px] font-light text-[#F2A900] tabular-nums">
          {seconds.toString().padStart(2,"0")}
        </span>
      </>
    ) : (
      <span className="text-[120px] font-light text-gray-400">
        WELCOME
      </span>
    )}
  </div>
</div>


<div className="text-center mb-12 text-[25px] text-gray-600">

{isPresetSelected && nextLevel && (
  <>
    <span className="font-medium">Next:</span>{" "}

    {nextLevel.type === "break" ? (
      <>Break</>
    ) : (
      <>
        {nextLevel.smallBlind}
        <span className="text-gray-600"> / </span>
        {nextLevel.bigBlind}
        <span className="text-gray-600"> ({nextLevel.ante})</span>
      </>
    )}

  </>
)}

</div>



<div className="flex items-center justify-center gap-12 text-[22px] text-gray-700">

<div>

<span className="text-gray-500">Players :  </span>

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

{isPresetModalOpen &&
  createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* HEADER */}
        <div className="p-6 pb-4">
          <h2 className="text-[18px] text-gray-900 font-semibold mb-4">ブラインドプリセット作成</h2>
          <label className="block text-[14px] text-gray-800 mb-1">プリセット名</label>
          <input value={presetName} onChange={e=>setPresetName(e.target.value)} className="w-full border rounded px-3 py-2 text-gray-900" placeholder="例: 通常トーナメント"/>
        </div>
        {/* BODY: レベルリストスクロール領域 */}
        <div className="flex-1 overflow-y-auto px-6">
          <label className="block text-[14px] text-gray-800 mb-2">レベルリスト</label>
          <div className="space-y-2">
            {levels.map((lv,idx)=>(
              <div key={idx} className="flex justify-between items-center border rounded px-2 py-1 bg-gray-50" draggable onDragStart={()=>handleDragStart(idx)} onDragEnter={()=>handleDragEnter(idx)} onDragEnd={handleDragEnd}>
                <div className="flex items-center gap-2">
                  <span className="cursor-move text-gray-400 mr-2">≡</span>
                  {lv.type==="level"? (
                    <>
                      <span className="font-bold text-gray-900">Level {getLevelNumber(idx)}</span>
                      <input type="number" min={1} step={1} value={lv.smallBlind??""} onChange={e=>{
                        const v = Math.max(1, Math.round(Number(e.target.value)))
                        setLevels(ls=>ls.map((l,i)=>{
                          if(i!==idx) return l;
                          // SB変更時、BB/ANTEも自動入力
                          const bb = Math.max(1, Math.round(v*2));
                          return {
                            ...l,
                            smallBlind: v,
                            bigBlind: bb,
                            ante: bb
                          };
                        }))
                      }} className="w-16 border rounded px-1 text-gray-900" placeholder="SB"/>
                      <span className="text-gray-900">/</span>
                      <input type="number" min={1} step={1} value={lv.bigBlind??""} onChange={e=>handleBbChange(idx,Number(e.target.value))} className="w-16 border rounded px-1 text-gray-900" placeholder="BB"/>
                      <span className="text-gray-900">(</span>
                      <input type="number" min={1} step={1} value={lv.ante??""} onChange={e=>{
                        const v = Math.max(1, Math.round(Number(e.target.value)))
                        setLevels(ls=>ls.map((l,i)=>i===idx?{...l,ante:v}:l))
                      }} className="w-16 border rounded px-1 text-gray-900" placeholder="ANTE"/>
                      <span className="text-gray-900">)</span>
                      <input type="number" min={1} step={1} value={lv.duration??""} onChange={e=>{
                        const v = Math.max(1, Math.round(Number(e.target.value)))
                        setLevels(ls=>ls.map((l,i)=>i===idx?{...l,duration:v}:l))
                      }} className="w-16 border rounded px-1 text-gray-900" placeholder="分"/>
                      <span className="text-gray-900">min</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-gray-900">Break</span>
                      <input type="number" min={1} step={1} value={lv.duration??""} onChange={e=>{
                        const v = Math.max(1, Math.round(Number(e.target.value)))
                        setLevels(ls=>ls.map((l,i)=>i===idx?{...l,duration:v}:l))
                      }} className="w-16 border rounded px-1 text-gray-900" placeholder="分"/>
                      <span className="text-gray-900">min</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <button className="text-red-500" onClick={()=>removeLevel(idx)}><FiTrash2 size={18}/></button>
                  {/* 点線メニュー・後で実装 */}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* FOOTER: 追加・保存ボタン固定 */}
        <div className="p-6 pt-4 border-t flex flex-col gap-4">
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-[#F2A900] text-white rounded" onClick={addLevel}>＋レベル追加</button>
            <button className="px-3 py-2 bg-blue-100 text-blue-700 rounded" onClick={addBreak}>＋ブレイク追加</button>
          </div>
          <div className="flex gap-4">
            <button className="px-5 py-2 bg-[#F2A900] text-white rounded font-bold" onClick={savePreset}>保存</button>
            <button className="px-5 py-2 bg-gray-200 text-gray-700 rounded font-bold" onClick={()=>setIsPresetModalOpen(false)}>キャンセル</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
  </div>
)
}