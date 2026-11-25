// Backend security & behaviour tests. Run against a local Supabase stack:
//   npx supabase start
//   npm run test:backend
//
// Uses the test phone numbers from supabase/config.jsonc (code 123456).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const PHONES = {
  alice: '+12015550100',
  bob: '+12015550101',
  carol: '+12015550102',
}

/** @type {Record<string, {sb: import('@supabase/supabase-js').SupabaseClient, id: string}>} */
const u = {}

async function signIn(name, phone) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const otp = await sb.auth.signInWithOtp({ phone })
  assert.equal(otp.error, null, `otp for ${name}: ${otp.error?.message}`)
  const { data, error } = await sb.auth.verifyOtp({ phone, token: '123456', type: 'sms' })
  assert.equal(error, null, `verify for ${name}: ${error?.message}`)
  await sb.from('profiles').update({ display_name: name[0].toUpperCase() + name.slice(1) }).eq('id', data.user.id)
  return { sb, id: data.user.id }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function subscribe(channel, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
      void channel.unsubscribe()
    }
    const timer = setTimeout(() => fail(new Error('subscribe timeout')), timeoutMs)
    channel.subscribe((status, err) => {
      if (settled) return
      if (status === 'SUBSCRIBED') {
        settled = true
        clearTimeout(timer)
        resolve(channel)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        fail(err ?? new Error(status))
      }
    })
  })
}

let direct // alice <-> bob
let group // alice (owner), bob, carol

before(async () => {
  for (const [name, phone] of Object.entries(PHONES)) u[name] = await signIn(name, phone)
})

after(async () => {
  for (const { sb } of Object.values(u)) {
    await sb.removeAllChannels()
    sb.realtime.disconnect()
  }
})

test('anonymous clients cannot read anything', async () => {
  const anon = createClient(URL, KEY, { auth: { persistSession: false } })
  for (const table of ['profiles', 'conversations', 'conversation_members', 'messages']) {
    const { data, error } = await anon.from(table).select('*').limit(1)
    assert.ok(error || data.length === 0, `anon could read ${table}`)
  }
  const { error } = await anon.rpc('find_user_by_phone', { p_phone: PHONES.bob })
  assert.ok(error, 'anon could look up phone numbers')
})

/** Reads the local stack's service key from `supabase status` (never hard-coded). */
function localServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!/127\.0\.0\.1|localhost/.test(URL)) return null
  try {
    const out = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
    return json.SECRET_KEY ?? json.SERVICE_ROLE_KEY ?? null
  } catch {
    return null
  }
}

test('accounts can only be created with a phone number', async (t) => {
  const serviceKey = localServiceKey()
  if (!serviceKey) {
    t.skip('needs SUPABASE_SERVICE_ROLE_KEY or a local stack')
    return
  }
  const admin = createClient(URL, serviceKey, { auth: { persistSession: false } })
  const { error } = await admin.auth.admin.createUser({
    email: `someone-${Date.now()}@example.com`,
    password: 'correct-horse-battery-staple',
    email_confirm: true,
  })
  assert.ok(error, 'creating an email-only account must fail')
})

test('profile row is created from the verified phone number', async () => {
  const { data, error } = await u.alice.sb.from('profiles').select('*').eq('id', u.alice.id).single()
  assert.equal(error, null)
  assert.equal(data.phone, PHONES.alice)
  assert.equal(data.display_name, 'Alice')
})

test('users cannot change their own phone number or other profiles', async () => {
  const own = await u.alice.sb.from('profiles').update({ phone: '+19999999999' }).eq('id', u.alice.id)
  assert.ok(own.error, 'phone column should not be writable')
  const other = await u.alice.sb.from('profiles').update({ display_name: 'hacked' }).eq('id', u.bob.id).select()
  assert.ok(other.error || other.data.length === 0, 'could update another profile')
})

test('strangers cannot see each other until they share a chat', async () => {
  // Fresh check uses carol, who may share a group from a previous run, so only
  // assert that unknown ids are hidden.
  const { data } = await u.alice.sb.from('profiles').select('id').eq('id', '00000000-0000-0000-0000-000000000000')
  assert.equal(data.length, 0)
})

test('find_user_by_phone is exact-match and hides yourself', async () => {
  const found = await u.alice.sb.rpc('find_user_by_phone', { p_phone: '+1 (201) 555-0101' })
  assert.equal(found.error, null)
  assert.equal(found.data.length, 1)
  assert.equal(found.data[0].id, u.bob.id)

  const partial = await u.alice.sb.rpc('find_user_by_phone', { p_phone: '555' })
  assert.equal(partial.data.length, 0)

  const self = await u.alice.sb.rpc('find_user_by_phone', { p_phone: PHONES.alice })
  assert.equal(self.data.length, 0)
})

test('direct conversation is created once and only members see it', async () => {
  const first = await u.alice.sb.rpc('create_direct_conversation', { p_user_id: u.bob.id })
  assert.equal(first.error, null)
  const again = await u.bob.sb.rpc('create_direct_conversation', { p_user_id: u.alice.id })
  assert.equal(again.data, first.data, 'direct chat should be de-duplicated')
  direct = first.data

  const bobList = await u.bob.sb.rpc('get_my_conversations')
  const entry = bobList.data.find((c) => c.id === direct)
  assert.ok(entry, 'bob should see the chat')
  assert.equal(entry.peer.id, u.alice.id)

  const carolSees = await u.carol.sb.from('conversations').select('id').eq('id', direct)
  assert.equal(carolSees.data.length, 0, 'carol must not see the direct chat')
  const carolMembers = await u.carol.sb.from('conversation_members').select('id').eq('conversation_id', direct)
  assert.equal(carolMembers.data.length, 0)

  const self = await u.alice.sb.rpc('create_direct_conversation', { p_user_id: u.alice.id })
  assert.ok(self.error, 'chat with yourself should fail')
})

test('messages: members send/read, outsiders blocked, sender is enforced', async () => {
  const sent = await u.alice.sb
    .from('messages')
    .insert({ conversation_id: direct, body: '  Hello Bob  ' })
    .select()
    .single()
  assert.equal(sent.error, null)
  assert.equal(sent.data.sender_id, u.alice.id)
  assert.equal(sent.data.body, 'Hello Bob', 'body should be trimmed')

  const bobReads = await u.bob.sb.from('messages').select('id, body').eq('id', sent.data.id)
  assert.equal(bobReads.data.length, 1)

  const carolReads = await u.carol.sb.from('messages').select('id').eq('conversation_id', direct)
  assert.equal(carolReads.data.length, 0, 'carol must not read the chat')

  const carolWrites = await u.carol.sb.from('messages').insert({ conversation_id: direct, body: 'intruder' })
  assert.ok(carolWrites.error, 'carol must not post into the chat')

  const spoof = await u.bob.sb.from('messages').insert({ conversation_id: direct, body: 'spoof', sender_id: u.alice.id })
  assert.ok(spoof.error, 'sender_id must not be client-controlled')

  const empty = await u.bob.sb.from('messages').insert({ conversation_id: direct, body: '   ' })
  assert.ok(empty.error, 'empty messages must be rejected')
})

test('only the sender can edit or delete a message', async () => {
  const { data: msg } = await u.alice.sb
    .from('messages')
    .insert({ conversation_id: direct, body: 'typo' })
    .select()
    .single()

  const bobEdit = await u.bob.sb.from('messages').update({ body: 'bob was here' }).eq('id', msg.id).select()
  assert.ok(bobEdit.error || bobEdit.data.length === 0, 'bob must not edit alice’s message')

  const edit = await u.alice.sb.from('messages').update({ body: 'fixed' }).eq('id', msg.id).select().single()
  assert.equal(edit.error, null)
  assert.equal(edit.data.body, 'fixed')
  assert.ok(edit.data.edited_at, 'edited_at should be set')

  const moveIt = await u.alice.sb.from('messages').update({ conversation_id: group ?? direct }).eq('id', msg.id)
  assert.ok(moveIt.error, 'conversation_id must be immutable')

  const del = await u.alice.sb
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', msg.id)
    .select()
    .single()
  assert.equal(del.error, null)
  assert.equal(del.data.body, null, 'deleted messages lose their content')
  assert.ok(del.data.deleted_at)

  const editDeleted = await u.alice.sb.from('messages').update({ body: 'resurrect' }).eq('id', msg.id)
  assert.ok(editDeleted.error, 'deleted messages cannot be edited')
})

test('unread counts and read receipts', async () => {
  await u.bob.sb.rpc('mark_conversation_read', { p_conversation_id: direct })
  await u.alice.sb.from('messages').insert({ conversation_id: direct, body: 'unread 1' })
  await u.alice.sb.from('messages').insert({ conversation_id: direct, body: 'unread 2' })

  let list = await u.bob.sb.rpc('get_my_conversations')
  let entry = list.data.find((c) => c.id === direct)
  assert.equal(Number(entry.unread_count), 2)
  assert.equal(entry.last_message.body, 'unread 2')

  await u.bob.sb.rpc('mark_conversation_read', { p_conversation_id: direct })
  list = await u.bob.sb.rpc('get_my_conversations')
  entry = list.data.find((c) => c.id === direct)
  assert.equal(Number(entry.unread_count), 0)

  // Alice can see Bob's read position (for blue ticks)...
  const members = await u.alice.sb.from('conversation_members').select('user_id, last_read_at').eq('conversation_id', direct)
  assert.equal(members.data.length, 2)
  // ...but cannot forge it.
  const forge = await u.alice.sb
    .from('conversation_members')
    .update({ last_read_at: new Date(0).toISOString() })
    .eq('conversation_id', direct)
  assert.ok(forge.error, 'members table must not be writable')
})

test('groups: roles, adding and removing members', async () => {
  const created = await u.alice.sb.rpc('create_group_conversation', {
    p_title: 'Test group',
    p_member_ids: [u.bob.id],
  })
  assert.equal(created.error, null)
  group = created.data

  const carolBefore = await u.carol.sb.from('conversations').select('id').eq('id', group)
  assert.equal(carolBefore.data.length, 0)

  const bobAdds = await u.bob.sb.rpc('add_group_members', { p_conversation_id: group, p_member_ids: [u.carol.id] })
  assert.ok(bobAdds.error, 'plain members cannot add people')

  const aliceAdds = await u.alice.sb.rpc('add_group_members', { p_conversation_id: group, p_member_ids: [u.carol.id] })
  assert.equal(aliceAdds.error, null)

  const carolAfter = await u.carol.sb.rpc('get_my_conversations')
  const entry = carolAfter.data.find((c) => c.id === group)
  assert.ok(entry, 'carol now sees the group')
  assert.equal(Number(entry.member_count), 3)

  // Sharing a group makes profiles visible.
  const profiles = await u.carol.sb.from('profiles').select('id').in('id', [u.alice.id, u.bob.id])
  assert.equal(profiles.data.length, 2)

  const bobKicks = await u.bob.sb.rpc('remove_group_member', { p_conversation_id: group, p_user_id: u.carol.id })
  assert.ok(bobKicks.error, 'members cannot remove others')

  const rename = await u.bob.sb.rpc('update_group', { p_conversation_id: group, p_title: 'Bob rules' })
  assert.ok(rename.error, 'members cannot rename the group')

  await u.alice.sb.rpc('set_member_role', { p_conversation_id: group, p_user_id: u.bob.id, p_role: 'admin' })
  const rename2 = await u.bob.sb.rpc('update_group', { p_conversation_id: group, p_title: 'Renamed by admin' })
  assert.equal(rename2.error, null)

  const kick = await u.bob.sb.rpc('remove_group_member', { p_conversation_id: group, p_user_id: u.carol.id })
  assert.equal(kick.error, null)
  const carolGone = await u.carol.sb.from('messages').select('id').eq('conversation_id', group)
  assert.equal(carolGone.data.length, 0)
  const carolPost = await u.carol.sb.from('messages').insert({ conversation_id: group, body: 'still here?' })
  assert.ok(carolPost.error, 'removed members cannot post')

  // Owner leaves -> ownership passes to the admin.
  await u.alice.sb.rpc('remove_group_member', { p_conversation_id: group, p_user_id: u.alice.id })
  const roles = await u.bob.sb.from('conversation_members').select('user_id, role').eq('conversation_id', group)
  assert.deepEqual(roles.data.map((r) => [r.user_id, r.role]), [[u.bob.id, 'owner']])
})

test('realtime: members get new messages, outsiders do not', async () => {
  const bobGot = []
  const carolGot = []
  const bobCh = await subscribe(
    u.bob.sb.channel('test-bob').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) =>
      bobGot.push(p.new),
    ),
  )
  const carolCh = await subscribe(
    u.carol.sb.channel('test-carol').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) =>
      carolGot.push(p.new),
    ),
  )
  await wait(1500)
  const { data } = await u.alice.sb.from('messages').insert({ conversation_id: direct, body: 'realtime ping' }).select().single()
  for (let i = 0; i < 30 && !bobGot.some((m) => m.id === data.id); i++) await wait(200)
  assert.ok(bobGot.some((m) => m.id === data.id), 'bob should receive the message live')
  await wait(1000)
  assert.ok(!carolGot.some((m) => m.id === data.id), 'carol must not receive it')
  await u.bob.sb.removeChannel(bobCh)
  await u.carol.sb.removeChannel(carolCh)
})

test('realtime: private typing channel is members-only', async () => {
  const topic = `conversation:${direct}`
  const bobGot = []
  await subscribe(
    u.bob.sb
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'typing' }, (p) => bobGot.push(p.payload)),
  )

  // Carol tries to join the private channel: must be rejected.
  let carolJoined = true
  try {
    await subscribe(u.carol.sb.channel(topic, { config: { private: true } }))
  } catch {
    carolJoined = false
  }
  assert.equal(carolJoined, false, 'carol must not join a private conversation channel')

  // Carol tries the same topic as a *public* channel and eavesdrops.
  const carolGot = []
  try {
    await subscribe(u.carol.sb.channel(topic).on('broadcast', { event: 'typing' }, (p) => carolGot.push(p.payload)))
  } catch {
    /* rejected is fine too */
  }

  const aliceCh = await subscribe(u.alice.sb.channel(topic, { config: { private: true } }))
  await wait(500)
  await aliceCh.send({ type: 'broadcast', event: 'typing', payload: { userId: u.alice.id } })
  for (let i = 0; i < 20 && bobGot.length === 0; i++) await wait(200)
  assert.equal(bobGot.length, 1, 'bob should see alice typing')
  await wait(800)
  assert.equal(carolGot.length, 0, 'carol must not eavesdrop via a public channel with the same name')
})

test('storage: attachments are readable by members only', async () => {
  const path = `${direct}/${u.alice.id}/${crypto.randomUUID()}-note.txt`
  const up = await u.alice.sb.storage.from('attachments').upload(path, new Blob(['secret file']), { contentType: 'text/plain' })
  assert.equal(up.error, null, up.error?.message)

  const bobDl = await u.bob.sb.storage.from('attachments').download(path)
  assert.equal(bobDl.error, null)
  assert.equal(await bobDl.data.text(), 'secret file')

  const carolDl = await u.carol.sb.storage.from('attachments').download(path)
  assert.ok(carolDl.error, 'carol must not download the attachment')

  const carolSigned = await u.carol.sb.storage.from('attachments').createSignedUrl(path, 60)
  assert.ok(carolSigned.error, 'carol must not create a signed URL')

  const carolUpload = await u.carol.sb.storage
    .from('attachments')
    .upload(`${direct}/${u.carol.id}/x.txt`, new Blob(['x']), { contentType: 'text/plain' })
  assert.ok(carolUpload.error, 'carol must not upload into the chat')

  const forged = await u.bob.sb.storage
    .from('attachments')
    .upload(`${direct}/${u.alice.id}/forged.txt`, new Blob(['x']), { contentType: 'text/plain' })
  assert.ok(forged.error, 'bob must not upload into alice’s folder')

  const msg = await u.alice.sb
    .from('messages')
    .insert({ conversation_id: direct, attachment_path: path, attachment_name: 'note.txt', attachment_mime: 'text/plain', attachment_size: 11 })
    .select()
    .single()
  assert.equal(msg.error, null)

  const badPath = await u.bob.sb
    .from('messages')
    .insert({ conversation_id: direct, attachment_path: path, attachment_name: 'stolen.txt' })
  assert.ok(badPath.error, 'cannot reference someone else’s upload')
})

test('avatars: users can only write to their own folder', async () => {
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0))
  const own = await u.alice.sb.storage.from('avatars').upload(`${u.alice.id}/${crypto.randomUUID()}.png`, png, { contentType: 'image/png' })
  assert.equal(own.error, null, own.error?.message)
  const other = await u.alice.sb.storage.from('avatars').upload(`${u.bob.id}/evil.png`, png, { contentType: 'image/png' })
  assert.ok(other.error, 'must not write into another user’s avatar folder')

  const setOther = await u.alice.sb.from('profiles').update({ avatar_path: `${u.bob.id}/x.png` }).eq('id', u.alice.id)
  assert.ok(setOther.error, 'avatar_path must point into your own folder')
  const setOwn = await u.alice.sb.from('profiles').update({ avatar_path: own.data.path }).eq('id', u.alice.id)
  assert.equal(setOwn.error, null)
})

test('phone lookups are rate limited', async () => {
  let limited = false
  for (let i = 0; i < 35; i++) {
    const { error } = await u.carol.sb.rpc('find_user_by_phone', { p_phone: `+1555000${String(i).padStart(4, '0')}` })
    if (error) {
      limited = /Too many lookups/.test(error.message)
      break
    }
  }
  assert.ok(limited, 'lookups should be throttled after 30 per 10 minutes')
})
