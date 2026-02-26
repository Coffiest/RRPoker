'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore'
import { FiArrowLeft, FiCheck, FiX, FiSearch, FiHome, FiCreditCard, FiUser } from 'react-icons/fi'
import HomeHeader from '@/components/HomeHeader'

type Player = {
  id: string
  playerId: string
  name: string
  iconUrl?: string
  rating: number
}

type FriendRequest = {
  id: string
  fromId: string
  fromName: string
  fromIcon?: string
  playerId: string
  createdAt: any
}

type Friend = {
  id: string
  playerId: string
  name: string
  iconUrl?: string
  rating: number
}

export default function FriendsPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showFriendsList, setShowFriendsList] = useState(false)

  // Fetch friend requests on mount
  useEffect(() => {
    const fetchFriendRequests = async () => {
      const user = auth.currentUser
      if (!user) return

      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()

      if (userData?.friendRequests) {
        const requests: FriendRequest[] = []
        for (const reqId of userData.friendRequests) {
          const reqDoc = await getDoc(doc(db, 'friendRequests', reqId))
          if (reqDoc.exists()) {
            const reqData = reqDoc.data()
            const fromUser = await getDoc(doc(db, 'users', reqData.fromUid))
            requests.push({
              id: reqId,
              fromId: reqData.fromUid,
              fromName: fromUser.data()?.name || 'ユーザー',
              fromIcon: fromUser.data()?.iconUrl,
              playerId: fromUser.data()?.playerId || '',
              createdAt: reqData.createdAt,
            })
          }
        }
        setFriendRequests(requests)
      }

      // Fetch friends list
      if (userData?.friends) {
        const friendsList: Friend[] = []
        for (const friendId of userData.friends) {
          const friendDoc = await getDoc(doc(db, 'users', friendId))
          if (friendDoc.exists()) {
            const friendData = friendDoc.data()
            friendsList.push({
              id: friendId,
              playerId: friendData.playerId,
              name: friendData.name || 'ユーザー',
              iconUrl: friendData.iconUrl,
              rating: friendData.rating || 1000,
            })
          }
        }
        setFriends(friendsList)
      }
    }

    fetchFriendRequests()
  }, [])

  // Search for players by playerId
  const searchPlayers = async () => {
    if (!searchInput.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      // Normalize the search input (add @ if not present)
      const normalizedInput = `@${searchInput.replace(/^@/, '')}`
      
      const playersRef = collection(db, 'users')
      const q = query(playersRef, where('playerId', '==', normalizedInput))
      const querySnapshot = await getDocs(q)

      const results: Player[] = []
      querySnapshot.forEach(doc => {
        const data = doc.data()
        results.push({
          id: doc.id,
          playerId: data.playerId,
          name: data.name || 'ユーザー',
          iconUrl: data.iconUrl,
          rating: data.rating || 1000,
        })
      })

      setSearchResults(results)
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setIsSearching(false)
    }
  }

  // Send friend request
  const sendFriendRequest = async (targetPlayer: Player) => {
    const user = auth.currentUser
    if (!user) return

    setLoading(true)
    try {
      const requestRef = doc(db, 'friendRequests', `${user.uid}_${targetPlayer.id}`)
      await setDoc(
        requestRef,
        {
          fromUid: user.uid,
          toUid: targetPlayer.id,
          createdAt: Timestamp.now(),
        },
        { merge: true }
      )

      // Add request ID to target user's friendRequests array
      const targetUserRef = doc(db, 'users', targetPlayer.id)
      await updateDoc(targetUserRef, {
        friendRequests: arrayUnion(requestRef.id),
      })

      // Clear search
      setSearchInput('')
      setSearchResults([])
      setSelectedPlayer(null)
    } catch (e) {
      console.error('Error sending friend request:', e)
    } finally {
      setLoading(false)
    }
  }

  // Accept friend request
  const acceptFriendRequest = async (request: FriendRequest) => {
    const user = auth.currentUser
    if (!user) return

    setLoading(true)
    try {
      // Add to both users' friend lists
      const userRef = doc(db, 'users', user.uid)
      const fromUserRef = doc(db, 'users', request.fromId)

      await Promise.all([
        updateDoc(userRef, {
          friends: arrayUnion(request.fromId),
          friendRequests: arrayRemove(request.id),
        }),
        updateDoc(fromUserRef, {
          friends: arrayUnion(user.uid),
        }),
      ])

      // Delete friend request
      await deleteDoc(doc(db, 'friendRequests', request.id))

      // Remove from requests list
      setFriendRequests(prev => prev.filter(r => r.id !== request.id))

      // Add to friends list
      const friendDoc = await getDoc(doc(db, 'users', request.fromId))
      const friendData = friendDoc.data()
      setFriends(prev => [
        ...prev,
        {
          id: request.fromId,
          playerId: friendData?.playerId || '',
          name: friendData?.name || 'ユーザー',
          iconUrl: friendData?.iconUrl,
          rating: friendData?.rating || 1000,
        },
      ])
    } catch (e) {
      console.error('Error accepting friend request:', e)
    } finally {
      setLoading(false)
    }
  }

  // Reject friend request
  const rejectFriendRequest = async (request: FriendRequest) => {
    const user = auth.currentUser
    if (!user) return

    setLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        friendRequests: arrayRemove(request.id),
      })

      // Delete friend request
      await deleteDoc(doc(db, 'friendRequests', request.id))

      // Remove from requests list
      setFriendRequests(prev => prev.filter(r => r.id !== request.id))
    } catch (e) {
      console.error('Error rejecting friend request:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white pb-24">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />

      <div className="mx-auto max-w-sm px-5 pt-6">
        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="プレイヤーIDを入力（例：@naoyuki）"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && searchPlayers()}
            className="flex-1 h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />
          <button
            type="button"
            onClick={searchPlayers}
            disabled={isSearching}
            className="h-12 w-12 rounded-2xl bg-[#F2A900] flex items-center justify-center text-gray-900 disabled:opacity-60"
          >
            <FiSearch className="text-[16px]" />
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map(player => (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className="w-full rounded-2xl border border-gray-200 bg-white/90 px-3 py-3 text-left hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {player.iconUrl ? (
                    <img src={player.iconUrl} alt={player.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[12px] text-gray-500">
                      P
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-gray-900">{player.name}</p>
                    <p className="text-[12px] text-gray-500">{player.playerId}</p>
                  </div>
                  <p className="text-[13px] font-semibold text-gray-700">{player.rating.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Player Detail Modal */}
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
            <div className="w-full max-w-sm rounded-[24px] bg-white p-6">
              <div className="flex items-center justify-center mb-4">
                {selectedPlayer.iconUrl ? (
                  <img src={selectedPlayer.iconUrl} alt={selectedPlayer.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <span className="text-[12px] text-gray-500">P</span>
                  </div>
                )}
              </div>

              <h2 className="text-center text-[18px] font-semibold text-gray-900">{selectedPlayer.name}</h2>
              <p className="text-center text-[13px] text-gray-500 mt-1">{selectedPlayer.playerId}</p>
              <p className="text-center text-[14px] font-semibold text-gray-700 mt-3">{selectedPlayer.rating.toLocaleString()} RR</p>

              <button
                type="button"
                onClick={() => sendFriendRequest(selectedPlayer)}
                disabled={loading}
                className="mt-6 w-full h-[52px] rounded-[24px] bg-[#F2A900] text-[15px] font-semibold text-gray-900 disabled:opacity-60"
              >
                フォローする
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPlayer(null)
                  setSearchInput('')
                  setSearchResults([])
                }}
                className="mt-2 w-full h-[52px] rounded-[24px] border border-gray-200 text-[15px] font-semibold text-gray-900"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {selectedPlayer && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              setSelectedPlayer(null)
              setSearchInput('')
              setSearchResults([])
            }}
          />
        )}

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[16px] font-semibold text-gray-900 mb-3">フォローリクエスト</h3>
            <div className="space-y-2">
              {friendRequests.map(request => (
                <div key={request.id} className="rounded-2xl border border-gray-200 bg-white/90 px-3 py-3 flex items-center gap-3">
                  {request.fromIcon ? (
                    <img src={request.fromIcon} alt={request.fromName} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[12px] text-gray-500">
                      P
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-gray-900">{request.fromName}</p>
                    <p className="text-[12px] text-gray-500">{request.playerId}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => acceptFriendRequest(request)}
                      disabled={loading}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-60"
                      aria-label="承認"
                    >
                      <FiCheck className="text-[16px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectFriendRequest(request)}
                      disabled={loading}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                      aria-label="拒否"
                    >
                      <FiX className="text-[16px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List Button */}
        {friends.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowFriendsList(!showFriendsList)}
              className="w-full h-[52px] rounded-[24px] border border-gray-200 text-[15px] font-semibold text-gray-900"
            >
              フレンド一覧（{friends.length}）
            </button>

            {showFriendsList && (
              <div className="mt-4 space-y-2">
                {friends.map(friend => (
                  <div
                    key={friend.id}
                    className="rounded-2xl border border-gray-200 bg-white/90 px-3 py-3 flex items-center gap-3"
                  >
                    {friend.iconUrl ? (
                      <img src={friend.iconUrl} alt={friend.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[12px] text-gray-500">
                        P
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-gray-900">{friend.name}</p>
                      <p className="text-[12px] text-gray-500">{friend.playerId}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-gray-700">{friend.rating.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {searchResults.length === 0 && friendRequests.length === 0 && friends.length === 0 && !selectedPlayer && (
          <div className="mt-12 text-center">
            <p className="text-[14px] text-gray-500">プレイヤーIDを検索してフレンドを追加しましょう</p>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
            aria-label="入出金"
          >
            <FiCreditCard className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">入出金</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}
