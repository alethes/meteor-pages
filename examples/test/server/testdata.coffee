chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
randstr = (len) ->
  str = ""
  for i in [1 .. len]
    str += chars[Math.floor(Math.random() * chars.length)]
  str

if !Items.findOne()
  for i in [1 .. 100]
    Items.insert
      id: i
      name: randstr 12