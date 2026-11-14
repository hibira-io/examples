#!/bin/bash
# Drives Chrome on the emulator: turn on order alerts, go to the lock screen, record until the push arrives.
set -x
OUT=rec-out; mkdir -p $OUT
A="adb"
tapText() { # tap the first node whose text or content-desc matches $1
  for i in $(seq 1 20); do
    $A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; $A pull /sdcard/ui.xml $OUT/ui.xml >/dev/null 2>&1
    b=$(python3 - "$1" <<'PY'
import re,sys
x=open('rec-out/ui.xml',encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>',x):
    n=m.group(0)
    t=re.search(r' text="([^"]*)"',n).group(1); d=re.search(r'content-desc="([^"]*)"',n).group(1)
    if re.search(sys.argv[1],t+' '+d,re.I):
        a=list(map(int,re.findall(r'\d+',re.search(r'bounds="([^"]*)"',n).group(1))));print((a[0]+a[2])//2,(a[1]+a[3])//2);break
PY
)
    if [ -n "$b" ]; then $A shell input tap $b; echo "tapped $1 at $b"; return 0; fi
    sleep 1
  done; echo "not found: $1"; return 1
}
$A root; sleep 2
$A shell pm list packages | grep -i chrome
echo "chrome --disable-fre --no-default-browser-check --no-first-run --disable-features=SigninPromo" > /tmp/cl
$A push /tmp/cl /data/local/chrome-command-line; $A shell chmod 644 /data/local/chrome-command-line
$A shell pm grant com.android.chrome android.permission.POST_NOTIFICATIONS || true
$A shell settings put global heads_up_notifications_enabled 1
$A shell settings put secure lockscreen.disabled 0
$A shell locksettings set-disabled false || true
$A reverse tcp:3000 tcp:3000
$A shell am start -a android.intent.action.VIEW -d http://localhost:3000/ com.android.chrome
sleep 12
$A exec-out screencap -p > $OUT/01-open.png
tapText 'Accept|Continue|No thanks|Use without' ; tapText 'No thanks|Got it|Skip' ; sleep 2
$A exec-out screencap -p > $OUT/02-page.png
tapText 'Turn on order alerts'; sleep 3
$A exec-out screencap -p > $OUT/03-prompt.png
tapText '^Allow' ; sleep 6
$A exec-out screencap -p > $OUT/04-on.png
# Signal ready and record the lock screen until the notification shows (or 9 minutes).
$A shell input keyevent KEYCODE_HOME; sleep 2
$A shell input keyevent KEYCODE_SLEEP; sleep 2; $A shell input keyevent KEYCODE_WAKEUP; sleep 2
$A exec-out screencap -p > $OUT/05-lock.png
git config user.name rec-bot; git config user.email rec-bot@users.noreply.github.com
date -u +%s > .github/rec/ready; git add .github/rec/ready; git commit -qm "rec: android ready [skip ci]"; git push -q origin HEAD:${GITHUB_REF_NAME} || true
for part in 1 2 3; do
  $A shell screenrecord --time-limit 180 --bit-rate 8000000 /sdcard/rec$part.mp4 &
  RP=$!
  for s in $(seq 1 90); do
    if $A shell dumpsys notification --noredact | grep -q "New order"; then echo "NOTIFIED part $part at $s"; date -u +%s > $OUT/notified; sleep 14; break 2; fi
    $A shell input keyevent KEYCODE_WAKEUP; sleep 2
  done
  wait $RP
done
$A shell pkill -INT screenrecord; sleep 3
for part in 1 2 3; do $A pull /sdcard/rec$part.mp4 $OUT/ 2>/dev/null; done
$A exec-out screencap -p > $OUT/06-after.png
$A shell cmd statusbar expand-notifications; sleep 2; $A exec-out screencap -p > $OUT/07-shade.png
ls -la $OUT; cat web-push-orders/server.log | tail -5
