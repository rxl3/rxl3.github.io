echo "[" > locality_stats.json

while read p; do
  echo "$p"
  curl https://www.police.wa.gov.au/apiws/CrimeStatsApi/GetLocalityCrimeStats/"$p" >> locality_stats.json
  echo "," >> locality_stats.json
done <localities_list_short

echo "]" >> locality_stats.json

# curl https://www.police.wa.gov.au/apiws/CrimeStatsApi/GetLocalityCrimeStats/