### TASKS

#### Server Actions (loop)

- [ ] login
  - [ ] handle player connect
  - [ ] handle player disconnect
- [ ] loop
  - [ ] check player state
    - [ ] NOTHING (+gr, -rr, -hr)
    - [ ] EMERGENCY NAP (+r \* 2)
    - [ ] EEPY (gr _ 0.5 +r _ 4, -hr)
    - [ ] CONSUME (1m minimum) (-g +hunger +rest)
    - [ ] WATCH (gr _ 1.25, +r _ 0.5, -hr \* 2)
    - [ ] FISHING (+g _ roll _ hb) (-r _ 2) (-hr _ 2)
    - [ ] MINING (+g _ roll _ hb) (-r _ 2) (-hr _ 2)
  - [ ] check player condition
    - [ ] if 0 sleep
      - [ ] force emergency nap
    - [ ] hunger is task buff
- [ ] twitch events
  - [ ] following (+.1 gr)
  - [ ] subbed (+1gr)
    - [ ] higher tier = higher rate?
  - [ ] bits (+bits \* 20)
  - [ ] raid (+20gr/5min)
  - [ ] (LATER) hype train (global rate increase according to train rank)
  - [ ] !wakeup, !engage, any chat??
    - [ ] open player session
    - [ ] sets player to watch
  - [ ] !lurk
    - [ ] sets player to watch
- [ ] handle actions
  - [ ] nothing
  - [ ] sleep (set player state -> sleep) Earns rest
  - [ ] consume (set player state -> consume, buy and consume items from shop immediately)
  - [ ] move (pond -> move)
  - [ ] emote (pond -> emote)
  - [ ] watch (set player state -> Task:watch) Tasks earn income
  - [ ] fishing (set player state -> Task:fish)
  - [ ] mining (set player state -> Task:Mining)
- [ ] shop
  - [ ] handle purchase
    - [ ] cookie (+0.25)
    - [ ] sammich (+0.5)
    - [ ] burger (+1)
    - [ ] biscuit (0.3)
    - [ ] fresh pilk (-0.1) (unlock emote mmmm pilk)
    - [ ] pilk (-0.5) (unlock emote tummy hurt)
    - [ ] pizza (+1)
    - [ ] pineapple pizza (+.99)
    - [ ] milkshake (+.25)
    - [ ] coffee (+0, +0.5rr)
- [ ] fishing (idle -> minigame)
- [ ] mining (idle -> minigame)

#### Player Actions (async)

- [ ] signup
- [ ] login
- [ ] sleep
- [ ] consume (eat)
- [ ] sit (watch, add other streamers)
- [ ] move
- [ ] emote
- [ ] shop
- [ ] fishing (idle -> minigame)
- [ ] mining (idle -> minigame)

#### PondOS

- [ ] connect to server/websocket
- [ ] handle player actions
  - [ ] start session
  - [ ] close session
  - [ ] NOTHING (walking)
  - [ ] EMERGENCY NAP (set sprite to nap)
  - [ ] EEPY (set sprite to nap)
  - [ ] CONSUME (set sprite to sit + item)
  - [ ] WATCH (set sprite to sit)
  - [ ] FISHING (set sprite to sit + rod)
  - [ ] MINING (set sprite to sit + pickaxe)

### Research

- Licenses

  - [ ] MIT
  - [ ] AGPL

- actions
  - can't accept new action until last action completes (lock on player)
  - one per client per frame
  - some actions have cooldowns
    - emote 3s
    - for each action, store the last complete event
    - send emote again too early
      -> lasttime - currenttime, elapsed time
      -> cooldown - elapsedtime -> you must wait x seconds

```ts
actions: map<dachi, action>;
setAction();
getAllActions();
```

### todo (yesterday)

- [x] check for null mods
- [x] initialize rate mod on dachi
- [x] need a check on action to validate action change
- [x] pre tick phase to validate ongoing mods
- [x] post tick phase to check on stats and auto crash
- [ ] implment non-state action

### todo

- [ ] get all the buttons working
- [ ] get a little guy on screen
- [ ] show dachis on overlay
- [ ] deploy
- [ ] make it pretty
- [ ] balance??
- [ ] make a variable named ThisVariableWasBroughtToYouByContemelia
