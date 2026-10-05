import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const startoArtists = [
  // グループ
  { name: 'SMAP' },
  { name: 'TOKIO' },
  { name: 'KinKi Kids' },
  { name: '嵐' },
  { name: 'V6' },
  { name: 'NEWS' },
  { name: '関ジャニ∞' },
  { name: 'KAT-TUN' },
  { name: 'Hey! Say! JUMP' },
  { name: 'Kis-My-Ft2' },
  { name: 'SixTONES' },
  { name: 'Snow Man' },
  { name: 'Travis Japan' },
  { name: 'なにわ男子' },
  { name: 'King & Prince' },
  { name: 'WEST.' },
  { name: 'Timelesz' },
  { name: 'Aぇ! group' },
  { name: 'HiHi Jets' },
  { name: '美 少年' },
  { name: '7 MEN 侍' },
  { name: 'Lilかんさい' },
  { name: 'Lil LEAGUE' },
  // ソロ
  { name: '木村拓哉' },
  { name: '城島茂' },
  { name: '国分太一' },
  { name: '松岡昌宏' },
  { name: '長瀬智也' },
  { name: '堂本光一' },
  { name: '堂本剛' },
]

async function seed() {
  console.log(`${startoArtists.length}組のアーティストを登録します...`)

  const { data, error } = await supabase
    .from('artists')
    .upsert(startoArtists, { onConflict: 'name', ignoreDuplicates: true })
    .select()

  if (error) {
    console.error('エラー:', error.message)
    process.exit(1)
  }

  console.log(`✅ ${data?.length ?? 0}組のアーティストを登録しました`)
}

seed()
