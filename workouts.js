/* ============================================================
   Exercise library + the 8-week bodyweight plan.
   met  = metabolic equivalent, used to estimate calories burned
   mode = "time" (hold/perform for N seconds) or "reps"
   cue  = short form pointers shown during the set
   ============================================================ */

window.EX = {
  /* ---------- warm-up / mobility ---------- */
  marchWarm:   {n:"March in place",        met:3.5, mode:"time", cue:["Drive the knee to hip height","Swing the opposite arm","Land soft, stay tall"]},
  armCircle:   {n:"Arm circles",           met:2.8, mode:"time", cue:["Big slow circles","Half forward, half backward","Keep ribs down"]},
  hipOpener:   {n:"Standing hip openers",  met:2.8, mode:"time", cue:["Knee up, then out to the side","Slow and controlled","Hold something if you wobble"]},
  catCow:      {n:"Cat-cow",               met:2.3, mode:"time", cue:["On all fours","Arch and round with your breath","Move the whole spine"]},
  legSwing:    {n:"Leg swings",            met:2.8, mode:"time", cue:["Front to back, relaxed","Hand on a wall for balance","Half the time each leg"]},
  shoulderRoll:{n:"Shoulder rolls",        met:2.3, mode:"time", cue:["Big backward circles","Let the arms hang heavy"]},
  worldGreat:  {n:"World's greatest stretch", met:3.0, mode:"time", cue:["Deep lunge, hand inside the front foot","Rotate up toward the ceiling","Alternate sides"]},
  torsoTwist:  {n:"Standing torso twists", met:2.5, mode:"time", cue:["Feet planted","Rotate from the ribs, not the arms"]},

  /* ---------- lower body ---------- */
  boxSquat:    {n:"Sit-to-stand squat",    met:4.0, mode:"reps", cue:["Sit back to a chair, stand up","Push through the whole foot","Chest proud"]},
  squat:       {n:"Bodyweight squat",      met:5.0, mode:"reps", cue:["Feet shoulder width, toes slightly out","Sit back and down, knees tracking over toes","Thighs to parallel if you can"]},
  squatPause:  {n:"Paused squat",          met:5.0, mode:"reps", cue:["Two-second hold at the bottom","Stay tight, don't collapse","Drive up hard"]},
  splitSquat:  {n:"Split squat",           met:4.5, mode:"reps", cue:["One foot forward, one back","Drop the back knee straight down","Half the reps each side"]},
  revLunge:    {n:"Reverse lunge",         met:5.0, mode:"reps", cue:["Step back, drop the knee","Front shin stays vertical","Alternate legs"]},
  bulgarian:   {n:"Bulgarian split squat", met:5.5, mode:"reps", cue:["Back foot on a chair","Weight in the front leg","Half the reps each side"]},
  gluteBridge: {n:"Glute bridge",          met:3.8, mode:"reps", cue:["Heels close to your backside","Squeeze the glutes at the top","Ribs down, don't arch the lower back"]},
  slGluteBr:   {n:"Single-leg glute bridge",met:4.5,mode:"reps", cue:["One foot planted, other knee to chest","Hips stay level","Half the reps each side"]},
  wallSit:     {n:"Wall sit",              met:4.0, mode:"time", cue:["Back flat on the wall","Thighs as close to parallel as you can hold","Breathe"]},
  calfRaise:   {n:"Calf raise",            met:3.5, mode:"reps", cue:["Rise onto the toes","Pause at the top","Lower slowly"]},
  stepUp:      {n:"Step-up",               met:5.5, mode:"reps", cue:["Use a stair or sturdy chair","Drive through the top foot","Half the reps each side"]},
  latLunge:    {n:"Lateral lunge",         met:4.8, mode:"reps", cue:["Step wide to the side","Sit into that hip, other leg straight","Alternate sides"]},
  squatPulse:  {n:"Squat pulse",           met:5.0, mode:"time", cue:["Hold the bottom, pulse a few inches","Stay low the whole time","Weight in the heels"]},

  /* ---------- upper body ---------- */
  wallPush:    {n:"Wall push-up",          met:3.5, mode:"reps", cue:["Hands on the wall, chest to wall","Body in one straight line","Slow on the way in"]},
  inclinePush: {n:"Incline push-up",       met:4.0, mode:"reps", cue:["Hands on a counter or sturdy chair","Straight line head to heels","Elbows about 45 degrees"]},
  kneePush:    {n:"Knee push-up",          met:4.5, mode:"reps", cue:["Knees down, hips forward","Chest to the floor, not the chin","Squeeze the glutes"]},
  pushup:      {n:"Push-up",               met:6.0, mode:"reps", cue:["Straight line head to heels","Elbows back at 45 degrees, not flared","Full range if you can"]},
  widePush:    {n:"Wide push-up",          met:6.0, mode:"reps", cue:["Hands wider than shoulders","More chest, less triceps","Control the descent"]},
  diamondPush: {n:"Diamond push-up",       met:6.5, mode:"reps", cue:["Hands together under the chest","Elbows tight to the body","Drop to knees if needed"]},
  pikePush:    {n:"Pike push-up",          met:6.0, mode:"reps", cue:["Hips high, head between the hands","Crown of the head toward the floor","This is your shoulder press"]},
  chairDip:    {n:"Chair dip",             met:5.0, mode:"reps", cue:["Hands on a chair edge behind you","Elbows straight back, not flared","Bend the knees to make it easier"]},
  tableRow:    {n:"Table row",             met:5.0, mode:"reps", cue:["Lie under a sturdy table, grip the edge","Pull the chest to the table","Body stays in a line"]},
  towelRow:    {n:"Towel door row",        met:4.5, mode:"reps", cue:["Towel around a door handle, lean back","Pull the elbows past the ribs","Squeeze the shoulder blades"]},
  superman:    {n:"Superman",              met:3.8, mode:"reps", cue:["Face down, lift chest and thighs","Squeeze the glutes and upper back","Look at the floor, not forward"]},
  ytw:         {n:"Prone Y-T-W",           met:3.5, mode:"time", cue:["Face down, arms overhead in a Y","Then out to a T, then bent to a W","Thumbs up, lift from the upper back"]},
  revSnowAngel:{n:"Reverse snow angel",    met:3.5, mode:"time", cue:["Face down, arms sweep overhead and back","Keep the hands off the floor","Slow"]},

  /* ---------- core ---------- */
  plank:       {n:"Plank",                 met:3.8, mode:"time", cue:["Forearms down, body in a line","Squeeze glutes, tuck the ribs","Don't let the hips sag"]},
  kneePlank:   {n:"Knee plank",            met:3.0, mode:"time", cue:["Knees down, hips forward","Straight line knees to head","Brace the stomach"]},
  sidePlank:   {n:"Side plank",            met:3.8, mode:"time", cue:["Stack the feet, lift the hips","Body in one line","Half the time each side"]},
  deadBug:     {n:"Dead bug",              met:3.5, mode:"reps", cue:["Back flat on the floor","Opposite arm and leg reach out","Slow, keep the back pinned down"]},
  birdDog:     {n:"Bird dog",              met:3.5, mode:"reps", cue:["All fours, opposite arm and leg","Reach long, don't arch","Pause a beat at the top"]},
  hollowHold:  {n:"Hollow hold",           met:4.0, mode:"time", cue:["Lower back pressed into the floor","Arms and legs off the ground","Bend the knees to make it easier"]},
  legRaise:    {n:"Lying leg raise",       met:4.0, mode:"reps", cue:["Hands under the hips","Legs straight, lower slowly","Stop before the back arches"]},
  bicycle:     {n:"Bicycle crunch",        met:5.0, mode:"reps", cue:["Opposite elbow toward opposite knee","Slow and deliberate","Don't yank the neck"]},
  flutter:     {n:"Flutter kick",          met:4.5, mode:"time", cue:["Legs a few inches off the floor","Small fast alternating kicks","Lower back stays down"]},
  russianTwist:{n:"Russian twist",         met:4.0, mode:"reps", cue:["Lean back, feet up or down","Rotate the ribcage side to side","Controlled, not frantic"]},
  mtnClimber:  {n:"Mountain climber",      met:8.0, mode:"time", cue:["Plank position, drive the knees in","Hips stay low","Fast but keep the form"]},

  /* ---------- cardio ---------- */
  marchFast:   {n:"Fast march",            met:4.5, mode:"time", cue:["Quick knees, pump the arms","Stay light on the feet"]},
  stepJack:    {n:"Step jack",             met:5.0, mode:"time", cue:["Step out instead of jumping","Arms overhead","Low impact version of a jumping jack"]},
  jumpJack:    {n:"Jumping jack",          met:8.0, mode:"time", cue:["Arms all the way overhead","Land soft on the balls of the feet"]},
  highKnee:    {n:"High knees",            met:8.0, mode:"time", cue:["Knees to hip height","Stay on the toes","Fast turnover"]},
  buttKick:    {n:"Butt kicks",            met:7.0, mode:"time", cue:["Heels to the backside","Stay tall, quick feet"]},
  skater:      {n:"Skater",                met:7.0, mode:"time", cue:["Bound side to side","Land on one leg, other leg sweeps behind","Soft knees"]},
  fastFeet:    {n:"Fast feet",             met:7.0, mode:"time", cue:["Tiny quick steps in place","Stay low in an athletic stance","Go as fast as you can hold"]},
  shadowBox:   {n:"Shadow boxing",         met:6.0, mode:"time", cue:["Light on the feet","Punch with rotation, not just the arm","Keep the hands up"]},
  squatToStand:{n:"Squat to stand",        met:5.0, mode:"time", cue:["Deep squat, reach the arms overhead as you rise","Continuous, rhythmic"]},
  burpeeStep:  {n:"Step-back burpee",      met:7.0, mode:"time", cue:["Hands down, step back one leg at a time","Step in, stand tall","No jump needed"]},
  burpee:      {n:"Burpee",                met:8.0, mode:"time", cue:["Chest to floor, jump the feet in","Jump at the top","Pace yourself, this one lies to you"]},
  jumpSquat:   {n:"Jump squat",            met:8.0, mode:"time", cue:["Squat down, explode up","Land soft, straight back into the next one"]},

  /* ---------- cooldown ---------- */
  childPose:   {n:"Child's pose",          met:2.3, mode:"time", cue:["Knees wide, hips back to the heels","Reach the arms long","Slow breathing"]},
  hamStretch:  {n:"Hamstring stretch",     met:2.3, mode:"time", cue:["One leg straight, hinge at the hips","Back stays flat","Half the time each side"]},
  hipFlexor:   {n:"Hip flexor stretch",    met:2.3, mode:"time", cue:["Half-kneeling, tuck the pelvis","Squeeze the back glute","Half the time each side"]},
  chestStretch:{n:"Doorway chest stretch", met:2.3, mode:"time", cue:["Forearm on the frame, step through","Feel it across the chest","Breathe into it"]},
  quadStretch: {n:"Standing quad stretch", met:2.3, mode:"time", cue:["Heel to backside, knees together","Stand tall","Half the time each side"]},
  downDog:     {n:"Downward dog",          met:2.8, mode:"time", cue:["Hips high, heels reaching down","Long spine","Pedal the feet if it's tight"]}
};

/* ============================================================
   Session templates.
   Each slot: [easyId, mediumId, hardId] — the plan picks by phase.
   reps/secs are the week-1 values; they scale up as weeks pass.
   ============================================================ */

const WARMUP = [
  {ex:["marchWarm","marchWarm","marchWarm"],  secs:45},
  {ex:["armCircle","armCircle","shoulderRoll"],secs:30},
  {ex:["hipOpener","legSwing","legSwing"],     secs:40},
  {ex:["catCow","catCow","worldGreat"],        secs:40}
];
const COOLDOWN = [
  {ex:["hamStretch","hamStretch","hamStretch"],  secs:40},
  {ex:["hipFlexor","hipFlexor","hipFlexor"],     secs:40},
  {ex:["childPose","childPose","downDog"],       secs:40}
];

window.SESSIONS = {
  lower: {
    name:"Lower Body Strength", focus:"Legs and glutes", rounds:[3,3,4,4],
    main:[
      {ex:["boxSquat","squat","squatPause"],           reps:[10,12,14]},
      {ex:["gluteBridge","gluteBridge","slGluteBr"],   reps:[12,15,10]},
      {ex:["splitSquat","revLunge","bulgarian"],       reps:[8,10,10]},
      {ex:["wallSit","wallSit","squatPulse"],          secs:[30,40,45]},
      {ex:["calfRaise","stepUp","stepUp"],             reps:[15,12,14]}
    ]
  },
  upper: {
    name:"Upper Body Strength", focus:"Chest, back, shoulders, arms", rounds:[3,3,4,4],
    main:[
      {ex:["inclinePush","kneePush","pushup"],         reps:[8,10,10]},
      {ex:["towelRow","towelRow","tableRow"],          reps:[10,12,10]},
      {ex:["pikePush","pikePush","pikePush"],          reps:[6,8,10]},
      {ex:["chairDip","chairDip","diamondPush"],       reps:[8,10,8]},
      {ex:["superman","ytw","revSnowAngel"],           reps:[12,0,0], secs:[0,35,40]}
    ]
  },
  cardio: {
    name:"Conditioning Circuit", focus:"Heart rate and calorie burn", rounds:[3,3,4,4],
    main:[
      {ex:["marchFast","stepJack","jumpJack"],         secs:[40,40,45]},
      {ex:["squatToStand","highKnee","highKnee"],      secs:[30,35,40]},
      {ex:["stepJack","skater","skater"],              secs:[40,40,45]},
      {ex:["mtnClimber","mtnClimber","mtnClimber"],    secs:[25,30,35]},
      {ex:["burpeeStep","burpeeStep","burpee"],        secs:[30,35,40]},
      {ex:["shadowBox","fastFeet","jumpSquat"],        secs:[40,40,40]}
    ]
  },
  full: {
    name:"Full Body + Core", focus:"Everything, plus midsection", rounds:[2,3,3,3],
    main:[
      {ex:["boxSquat","squat","jumpSquat"],            reps:[12,14,0], secs:[0,0,40]},
      {ex:["inclinePush","kneePush","widePush"],       reps:[8,10,12]},
      {ex:["revLunge","revLunge","latLunge"],          reps:[10,12,12]},
      {ex:["kneePlank","plank","plank"],               secs:[30,40,50]},
      {ex:["deadBug","birdDog","hollowHold"],          reps:[10,12,0], secs:[0,0,35]},
      {ex:["sidePlank","sidePlank","sidePlank"],       secs:[30,40,45]},
      {ex:["russianTwist","bicycle","bicycle"],        reps:[16,20,24]}
    ]
  }
};

/* Weekly running order. Four sessions, spaced so nothing hits the same
   muscles two days running. */
window.WEEK_ORDER = ["lower","cardio","upper","full"];

/* Phase per week (index into the three variation levels + rounds array).
   Weeks 1-2 easy, 3-4 easy with more volume, 5-6 medium, 7-8 hard. */
window.PHASE_OF_WEEK = [0,0,1,1,2,2,3,3];
window.LEVEL_OF_PHASE = [0,0,1,2];
window.REST_OF_PHASE  = [60,50,45,40];

/* ============================================================
   Muscle group per exercise — drives same-target swaps.
   ============================================================ */
window.GROUP = {};
(function(){
  const g = {
    mobility:["marchWarm","armCircle","hipOpener","catCow","legSwing","shoulderRoll","worldGreat","torsoTwist",
              "childPose","hamStretch","hipFlexor","chestStretch","quadStretch","downDog"],
    lower:["boxSquat","squat","squatPause","splitSquat","revLunge","bulgarian","gluteBridge","slGluteBr",
           "wallSit","calfRaise","stepUp","latLunge","squatPulse"],
    push:["wallPush","inclinePush","kneePush","pushup","widePush","diamondPush","pikePush","chairDip"],
    pull:["tableRow","towelRow","superman","ytw","revSnowAngel"],
    core:["plank","kneePlank","sidePlank","deadBug","birdDog","hollowHold","legRaise","bicycle","flutter",
          "russianTwist","mtnClimber"],
    cardio:["marchFast","stepJack","jumpJack","highKnee","buttKick","skater","fastFeet","shadowBox",
            "squatToStand","burpeeStep","burpee","jumpSquat"]
  };
  Object.keys(g).forEach(k=>g[k].forEach(id=>{ window.GROUP[id]=k; }));
})();

window.GROUP_LABEL = { lower:"Legs & glutes", push:"Push", pull:"Pull & back", core:"Core",
                       cardio:"Cardio", mobility:"Mobility" };

/* ============================================================
   Alternate versions of each session.
   Every variant hits the same target as the planned session, so
   choosing one still counts toward the 8-week progression.
   ============================================================ */
window.VARIANTS = {
  lower: [
    { key:"a", label:"Balanced", desc:"The default mix — squat, hinge, single leg",
      main: window.SESSIONS.lower.main },
    { key:"b", label:"Glutes & hamstrings", desc:"More hinging, less quad",
      main:[
        {ex:["gluteBridge","gluteBridge","slGluteBr"],   reps:[14,16,10]},
        {ex:["revLunge","revLunge","bulgarian"],         reps:[10,12,10]},
        {ex:["boxSquat","squat","squatPause"],           reps:[10,12,12]},
        {ex:["latLunge","latLunge","latLunge"],          reps:[8,10,12]},
        {ex:["calfRaise","calfRaise","stepUp"],          reps:[15,18,12]}
      ]},
    { key:"c", label:"Easy on the joints", desc:"Chair-supported, nothing explosive",
      main:[
        {ex:["boxSquat","boxSquat","squat"],             reps:[12,14,14]},
        {ex:["gluteBridge","gluteBridge","gluteBridge"], reps:[14,16,18]},
        {ex:["splitSquat","splitSquat","splitSquat"],    reps:[8,10,12]},
        {ex:["wallSit","wallSit","wallSit"],             secs:[30,40,50]},
        {ex:["calfRaise","calfRaise","calfRaise"],       reps:[15,18,20]}
      ]}
  ],
  upper: [
    { key:"a", label:"Balanced", desc:"Push and pull evenly",
      main: window.SESSIONS.upper.main },
    { key:"b", label:"Push focus", desc:"Chest, shoulders and triceps",
      main:[
        {ex:["wallPush","inclinePush","pushup"],         reps:[10,10,10]},
        {ex:["pikePush","pikePush","pikePush"],          reps:[6,8,10]},
        {ex:["chairDip","chairDip","chairDip"],          reps:[8,10,12]},
        {ex:["inclinePush","kneePush","widePush"],       reps:[8,10,10]},
        {ex:["superman","superman","superman"],          reps:[12,14,16]}
      ]},
    { key:"c", label:"Pull & posture", desc:"Back and rear shoulders — good desk antidote",
      main:[
        {ex:["towelRow","towelRow","tableRow"],          reps:[10,12,10]},
        {ex:["superman","superman","superman"],          reps:[12,14,16]},
        {ex:["ytw","ytw","ytw"],                         secs:[30,35,40]},
        {ex:["revSnowAngel","revSnowAngel","revSnowAngel"], secs:[30,35,40]},
        {ex:["inclinePush","kneePush","pushup"],         reps:[8,10,10]}
      ]}
  ],
  cardio: [
    { key:"a", label:"Balanced", desc:"Mixed intensity circuit",
      main: window.SESSIONS.cardio.main },
    { key:"b", label:"Low impact", desc:"No jumping — quiet, apartment friendly",
      main:[
        {ex:["marchFast","marchFast","marchFast"],       secs:[45,50,55]},
        {ex:["stepJack","stepJack","stepJack"],          secs:[40,45,50]},
        {ex:["squatToStand","squatToStand","squatToStand"], secs:[35,40,45]},
        {ex:["shadowBox","shadowBox","shadowBox"],       secs:[45,50,55]},
        {ex:["burpeeStep","burpeeStep","burpeeStep"],    secs:[30,35,40]},
        {ex:["fastFeet","fastFeet","fastFeet"],          secs:[30,35,40]}
      ]},
    { key:"c", label:"Hard intervals", desc:"High impact, highest burn",
      main:[
        {ex:["jumpJack","jumpJack","jumpJack"],          secs:[40,45,45]},
        {ex:["highKnee","highKnee","highKnee"],          secs:[30,35,40]},
        {ex:["mtnClimber","mtnClimber","mtnClimber"],    secs:[30,35,40]},
        {ex:["skater","skater","skater"],                secs:[40,40,45]},
        {ex:["burpee","burpee","burpee"],                secs:[30,35,40]},
        {ex:["jumpSquat","jumpSquat","jumpSquat"],       secs:[30,35,40]}
      ]}
  ],
  full: [
    { key:"a", label:"Balanced", desc:"Whole body plus core",
      main: window.SESSIONS.full.main },
    { key:"b", label:"Core heavy", desc:"Same full-body base, much more midsection",
      main:[
        {ex:["boxSquat","squat","squat"],                reps:[12,14,16]},
        {ex:["inclinePush","kneePush","pushup"],         reps:[8,10,10]},
        {ex:["kneePlank","plank","plank"],               secs:[30,40,50]},
        {ex:["deadBug","deadBug","hollowHold"],          reps:[12,14,0], secs:[0,0,35]},
        {ex:["sidePlank","sidePlank","sidePlank"],       secs:[30,40,45]},
        {ex:["birdDog","bicycle","bicycle"],             reps:[12,20,24]},
        {ex:["flutter","flutter","legRaise"],            secs:[25,30,0], reps:[0,0,12]}
      ]},
    { key:"c", label:"Fast circuit", desc:"Shorter, moves quickly, gets the heart up",
      main:[
        {ex:["boxSquat","squat","jumpSquat"],            reps:[14,16,0], secs:[0,0,40]},
        {ex:["inclinePush","kneePush","pushup"],         reps:[10,10,12]},
        {ex:["revLunge","revLunge","revLunge"],          reps:[12,14,16]},
        {ex:["mtnClimber","mtnClimber","mtnClimber"],    secs:[25,30,35]},
        {ex:["kneePlank","plank","plank"],               secs:[30,40,45]}
      ]}
  ]
};

/* ============================================================
   Body zones per exercise — drives the body-map picker.
   Zones: chest arms shoulders back abs glutes legs cardio
   ============================================================ */
window.ZONES = {
  boxSquat:["legs","glutes"], squat:["legs","glutes"], squatPause:["legs","glutes"],
  splitSquat:["legs","glutes"], revLunge:["legs","glutes"], bulgarian:["legs","glutes"],
  gluteBridge:["glutes"], slGluteBr:["glutes"], wallSit:["legs"], calfRaise:["legs"],
  stepUp:["legs","glutes"], latLunge:["legs","glutes"], squatPulse:["legs"],

  wallPush:["chest","arms"], inclinePush:["chest","arms"], kneePush:["chest","arms"],
  pushup:["chest","arms","shoulders"], widePush:["chest","shoulders"],
  diamondPush:["arms","chest"], pikePush:["shoulders","arms"], chairDip:["arms","chest"],

  tableRow:["back","arms"], towelRow:["back","arms"], superman:["back"],
  ytw:["back","shoulders"], revSnowAngel:["back","shoulders"],

  plank:["abs"], kneePlank:["abs"], sidePlank:["abs"], deadBug:["abs"],
  birdDog:["abs","back"], hollowHold:["abs"], legRaise:["abs"], bicycle:["abs"],
  flutter:["abs"], russianTwist:["abs"], mtnClimber:["abs","cardio"],

  marchFast:["cardio"], stepJack:["cardio"], jumpJack:["cardio"],
  highKnee:["cardio","legs"], buttKick:["cardio","legs"], skater:["cardio","legs"],
  fastFeet:["cardio"], shadowBox:["cardio","arms"], squatToStand:["cardio","legs"],
  burpeeStep:["cardio","chest","legs"], burpee:["cardio","chest","legs"],
  jumpSquat:["cardio","legs","glutes"]
};

window.ZONE_LABEL = { chest:"Chest", arms:"Arms", shoulders:"Shoulders", back:"Back",
                      abs:"Abs & core", glutes:"Glutes", legs:"Legs", cardio:"Cardio" };

/* Which zones each planned session is really training. A body-part session
   counts toward the plan when it mostly overlaps the planned day's zones. */
window.TYPE_ZONES = {
  lower:  ["legs","glutes"],
  upper:  ["chest","arms","shoulders","back"],
  cardio: ["cardio"],
  full:   ["chest","arms","shoulders","back","abs","glutes","legs"]
};
