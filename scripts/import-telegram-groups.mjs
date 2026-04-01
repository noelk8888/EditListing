import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const groups = [
  {"name":"205 SANTOLAN","link":"https://t.me/+W0LP8Qwq2n9hMjM1"},
  {"name":"53 BENITEZ","link":"https://t.me/+1xRrTSZtYi8xN2Q1"},
  {"name":"68 ROCES","link":"https://t.me/+5EhkiLp4DXA3NDk1"},
  {"name":"ABOITIZ INFRACAPITAL","link":"https://t.me/+ztFl_0GygppjMWRl"},
  {"name":"ACROPOLIS","link":"https://t.me/+tmoo00zwepZjY2Vl"},
  {"name":"ALABANG COMMERCIAL PROPERTIES","link":"https://t.me/+zYoLnRXNUp00YzI1"},
  {"name":"AFPOVAI","link":"https://t.me/+lfilPUPrPShiYWJl"},
  {"name":"ANVAYA","link":"https://t.me/+mwYpOmwYTQliODc1"},
  {"name":"ALABANG 400","link":"https://t.me/+kZgAwk_k_UkxZTFl"},
  {"name":"ALABANG WEST","link":"https://t.me/+dD9dxW_TI2swYTc1"},
  {"name":"THE ALEXANDRA","link":"https://t.me/+5QwdMZWSuTM1OWNl"},
  {"name":"ALVENDIA BY ROCKWELL","link":"https://t.me/+L9PU3p09Zg9mNjhl"},
  {"name":"AIRBNB PROPERTIES","link":"https://t.me/+ApwKTy464qUzMjFl"},
  {"name":"AVIDA VERTIS","link":"https://t.me/+20HLZyR3gv03Mzll"},
  {"name":"AYALA ALABANG","link":"https://t.me/+-_NNd3w44hM5NmY1"},
  {"name":"AYALA GREENFIELD ESTATES","link":"https://t.me/+C2YKzskTlNxiNTQ9"},
  {"name":"AYALA HEIGHTS","link":"https://t.me/+LwoC_SECIU43NzA1"},
  {"name":"AYALA HILLSIDE ESTATES","link":"https://t.me/+pAZwUxiZs1thNTc9"},
  {"name":"AYALA LAND ESTATES","link":"https://t.me/+MIQ_aw78uplkZTQ1"},
  {"name":"AYALA WESTGROVE HEIGHTS","link":"https://t.me/+haPNYayfucExMjZl"},
  {"name":"BDO FORECLOSED PROPERTIES","link":"https://t.me/+xl74sRPHBQk5N2I1"},
  {"name":"BEL AIR","link":"https://t.me/+iV_40FzYE3Q5NjJl"},
  {"name":"BF HOMES","link":"https://t.me/+IaKuQ8IvPDU3YzA1"},
  {"name":"BGC SALE","link":"https://t.me/+lWvwE12b6Q83M2M9"},
  {"name":"BGC LEASE","link":"https://t.me/+WqQb9YABc5I5MGI9"},
  {"name":"BLUE RIDGE","link":"https://t.me/+nTSNs3UI7YdhMGNl"},
  {"name":"BULACAN","link":"https://t.me/+k9xYrwt4cqc0ZjRl"},
  {"name":"CALOOCAN CITY","link":"https://t.me/+_mGsdRrbWr4xNjJl"},
  {"name":"CAPITOL 8","link":"https://t.me/+fdmffXXM_cIxNjdl"},
  {"name":"CASA MILAN","link":"https://t.me/+1dXc9WXd8I5hNjM1"},
  {"name":"CASA VERDE","link":"https://t.me/+sQJJQiCOZE8zYzg1"},
  {"name":"CAVITE","link":"https://t.me/+kj39zU3cS9NjN2Rl"},
  {"name":"CEBU","link":"https://t.me/+GPxX14QgNhhiMmQ9"},
  {"name":"CINCO HERMANOS","link":"https://t.me/+d4e9GRDEo-djYTc1"},
  {"name":"CENTURY PROPERTIES","link":"https://t.me/+8bIEjh2vj2w2NzQ9"},
  {"name":"CHINO ROCES","link":"https://t.me/+IgrjoLxGPURlNDc1"},
  {"name":"CONGRESSIONAL","link":"https://t.me/+58Pc-9j-YYxhMTg1"},
  {"name":"CONNOR GREENHILLS","link":"https://t.me/+Jy2HahKUCdQyNGI1"},
  {"name":"CORINTHIAN GARDENS","link":"https://t.me/+VzFAZpLIgmcxMjBl"},
  {"name":"CUBAO","link":"https://t.me/+_6hPNaESUIJhMjE1"},
  {"name":"DAMAR VILLAGE","link":"https://t.me/+XBFkKLDTIV85MjFl"},
  {"name":"DASMA","link":"https://t.me/+TjufytT4mPJlZThl"},
  {"name":"DONA JUANA SUBDIVISION","link":"https://t.me/+7uxM0-WpCtQwM2Jl"},
  {"name":"EAST & WEST GALLERY PLACE BGC","link":"https://t.me/+T4U3YuRHeocwMTg1"},
  {"name":"EDSA COMMERCIAL PROPERTIES","link":"https://t.me/+BrmBKURMA_AwYWQ1"},
  {"name":"FILINVEST QC","link":"https://t.me/+q8eypMj9AxdiNjdl"},
  {"name":"FORBES","link":"https://t.me/+tpt1OYX3hUs4NmU1"},
  {"name":"GREENHILLS","link":"https://t.me/+63Ha4AFHg-ZmNDVl"},
  {"name":"GREENMEADOWS","link":"https://t.me/+yI-6GdIJn-ZiN2U1"},
  {"name":"GREENWOODS","link":"https://t.me/+oFWfk1bFZ7BjMjJl"},
  {"name":"HEROES HILL SFDM","link":"https://t.me/+4bVOTQeJKbRhNTZl"},
  {"name":"HILLSBOROUGH","link":"https://t.me/+_XRPX-snfhA0MDM9"},
  {"name":"HORIZON HOMES","link":"https://t.me/+IrKI234sXb00YTM1"},
  {"name":"HORSESHOE VILLAGE","link":"https://t.me/+vym_r2Z73xRiNDI1"},
  {"name":"INTERSTATE TOWNHOMES","link":"https://t.me/+B94pvI5GWmcxYmY9"},
  {"name":"KAPITOLYO","link":"https://t.me/+iYX-Vpl3-nM0MzZl"},
  {"name":"LAGUNA","link":"https://t.me/+o6FPIpHDX5E2NTk9"},
  {"name":"LOYOLA GRAND VILLAS","link":"https://t.me/+-EaBYbXWbS1mMDc1"},
  {"name":"LUNTALA VALLE VERDE","link":"https://t.me/+cXCaOv6lCx0xNWNl"},
  {"name":"MAGALLANES","link":"https://t.me/+SvMGhPUUtyc2YzVl"},
  {"name":"MAKATI CITY COMMERCIAL PROPERTIES","link":"https://t.me/+2NAkjwnWd7hiZWQ1"},
  {"name":"MANILA CITY COMMERCIAL PROPERTIES","link":"https://t.me/+2do_svKtswI2ZjBl"},
  {"name":"MAHOGANY PLACE ACACIA ESTATES","link":"https://t.me/+C6G_xVJ_FJk4ZDk1"},
  {"name":"MANILA SOUTHWOODS","link":"https://t.me/+YjgnOk45ivBiMGY1"},
  {"name":"MANDALUYONG CITY COMMERCIAL PROPERTIES","link":"https://t.me/+5lnvAx3FAThmN2E1"},
  {"name":"MARIKINA CITY COMMERCIAL PROPERTIES","link":"https://t.me/+5Id5aTW7WfxmYjE1"},
  {"name":"MARINA BAYTOWN","link":"https://t.me/+mhTb5s51Y9BjOTE1"},
  {"name":"MERVILLE PARK","link":"https://t.me/+5q7R0IRKQP41Mjg1"},
  {"name":"METROSUMMIT","link":"https://t.me/+WH9NNnaesuk1ZTFl"},
  {"name":"MCKINLEY HILL","link":"https://t.me/+xMJ49YRUn-ljMjM9"},
  {"name":"MIDLAND MANOR","link":"https://t.me/+pG2sb7iAXbNhZTdl"},
  {"name":"MIRA NILA QC","link":"https://t.me/+bkjPArTg975iMzhl"},
  {"name":"MONTGOMERY","link":"https://t.me/+Wjg3sldGnqkzZTZl"},
  {"name":"MOWELFUND M RESIDENCES NEW MANILA","link":"https://t.me/+0MnBrqWLzg4xMzc1"},
  {"name":"MULTINATIONAL VILLAGE","link":"https://t.me/+TqvYG7-8i8IyMmJl"},
  {"name":"NEW MANILA","link":"https://t.me/+jT5JraHQF2JiNzk1"},
  {"name":"NEW MANILA SCOUT WEST TRIANGLE FOR LEASE","link":"https://t.me/+p4-c0SNAWOs2OTdl"},
  {"name":"NUVALI","link":"https://t.me/+XTGqOhs9UjJlZWY1"},
  {"name":"ONE BALETE","link":"https://t.me/+-EJZ8fwFbm8xNzll"},
  {"name":"ONE SHANG ST. FRANCIS","link":"https://t.me/+D5IgqGB0fHZlYzk1"},
  {"name":"ORTIGAS CENTER COMMERCIAL PROPERTIES","link":"https://t.me/+VaBE38HQyPEwZDY1"},
  {"name":"OTIS 888 RESIDENCES","link":"https://t.me/+1rjL7C5auKk4NmY1"},
  {"name":"PALAWAN","link":"https://t.me/+metORDZmFBM2OWU9"},
  {"name":"PALM VILLAGE","link":"https://t.me/+ghdeN3aGBWAzYzA1"},
  {"name":"PAMPANGA","link":"https://t.me/+uq9lxt_MRsxjMWRl"},
  {"name":"PARANAQUE CITY COMMERCIAL PROPERTIES","link":"https://t.me/+5z_p7YI7X4UyZTRl"},
  {"name":"PASAY CITY COMMERCIAL PROPERTIES","link":"https://t.me/+OH9o1Sh28eZmODE1"},
  {"name":"PASIG CITY COMMERCIAL PROPERTIES","link":"https://t.me/+nSeh-kuJNzJiMTE1"},
  {"name":"PHILAM HOMES","link":"https://t.me/+xBG165WOatQ3NzVl"},
  {"name":"PHOENIX SUBDIVISION","link":"https://t.me/+vPRADCiL1_Q1MjQ1"},
  {"name":"PRESELLO LISTINGS","link":"https://t.me/+5RwXrB6tJaQ2ODdl"},
  {"name":"PUNTA FUEGO","link":"https://t.me/+Qi5m_gqG1wM2OGY1"},
  {"name":"QUEZON AVE. COMMERCIAL PROPERTIES","link":"https://t.me/+5aXInCZCwf44ODg1"},
  {"name":"QUEZON CITY COMMERCIAL PROPERTIES","link":"https://t.me/+Cuw2htEzrso1MjU1"},
  {"name":"ROBINSONS MAGNOLIA","link":"https://t.me/+dOHFnxj87PU1ZmE1"},
  {"name":"ROCKWELL LEASE","link":"https://t.me/+R3xZNwR-Rgo1ODdl"},
  {"name":"ROCKWELL SALE","link":"https://t.me/+ziC6Wyssv10yYTg1"},
  {"name":"ROLLING HILLS","link":"https://t.me/+SpJdcp0y5E5kOGU9"},
  {"name":"SAN JUAN CITY COMMERCIAL PROPERTIES","link":"https://t.me/+D4LF18L6SpI2YzRl"},
  {"name":"SAN JUAN FOR LEASE","link":"https://t.me/+qdth03YlKpY5YjRl"},
  {"name":"SAN MIGUEL VILLAGE","link":"https://t.me/+VbYsZkOMVKg4NTg1"},
  {"name":"SAN LORENZO","link":"https://t.me/+eqtzix20FzowOTY1"},
  {"name":"SCOUT AREA","link":"https://t.me/+DYga1Do9Xhs5ODI1"},
  {"name":"SHANG PROPERTIES","link":"https://t.me/+zdNddfXI-eVlZjc9"},
  {"name":"SITIO SEVILLE","link":"https://t.me/+j_i47woC-BRhNWVl"},
  {"name":"SOUTHVALE PRIMERA SONERA","link":"https://t.me/+1ngrUCr_7tNiMDA1"},
  {"name":"ST. IGNATIUS","link":"https://t.me/+Jg4SKpa5Nzg5Yzhl"},
  {"name":"STA MESA HEIGHTS","link":"https://t.me/+AcUxXqGCrdkzMTJl"},
  {"name":"THE SUITES BY ALP BGC","link":"https://t.me/+jODBOc4ozLA3NzE1"},
  {"name":"TALAYAN VILLAGE","link":"https://t.me/+OClRn9WciQwzYjVl"},
  {"name":"TAGAYTAY BATANGAS","link":"https://t.me/+1DFA4PlL3yU4OGFl"},
  {"name":"TAGAYTAY HIGHLANDS","link":"https://t.me/+wiMLut_zQFoyOTBl"},
  {"name":"TAGUIG & LAS PINAS CITY","link":"https://t.me/+WqTqW2OoSLU0OTE1"},
  {"name":"TALI BEACH","link":"https://t.me/+hCb7xCWbSSVmMjI1"},
  {"name":"TAYTAY RIZAL ANTIPOLO","link":"https://t.me/+mVx0vzpSJ69kYjRl"},
  {"name":"TEACHER'S VILLAGE","link":"https://t.me/+vx35HbA9w2MwZjI1"},
  {"name":"TIERRA PURA","link":"https://t.me/+zAZh5xT8v1g1Y2Zl"},
  {"name":"TIMOG","link":"https://t.me/+Fzkhdp_q5RdkYmU1"},
  {"name":"TIVOLI ROYALE","link":"https://t.me/+-48GCH2BmvExZWNl"},
  {"name":"THE RESIDENCES AT GREENBELT","link":"https://t.me/+HWMmRIxAAUAxZDM1"},
  {"name":"TRANSPHIL","link":"https://t.me/+MuUOctHVG9NjNDI1"},
  {"name":"URDANETA","link":"https://t.me/+IZQsgQ-x9c4wZGM9"},
  {"name":"VALENCIA HILLS","link":"https://t.me/+aAM65I8wkNMwNGZl"},
  {"name":"VALENZUELA CITY COMMERCIAL PROPERTIES","link":"https://t.me/+h8xwvkFIHF45NTY1"},
  {"name":"VALLE VERDE","link":"https://t.me/+7kP04QYWlhIxNzM1"},
  {"name":"VALLEY GOLF PARKRIDGE","link":"https://t.me/+XwlXu3RgqA4xMTk9"},
  {"name":"THE VANTAGE AT KAPITOLYO","link":"https://t.me/+YbnU3aXXXIo4NDA1"},
  {"name":"VIRIDIAN","link":"https://t.me/+k2K3AxXLEtZhYTE1"},
  {"name":"WACK WACK","link":"https://t.me/+9gOmxCFrYhoxMmU1"},
  {"name":"WEECOM","link":"https://t.me/+MKJDSdduAscwNWQ1"},
  {"name":"WEST AVE","link":"https://t.me/+11F6w1sDWQtjZDVl"},
  {"name":"WEST TRIANGLE","link":"https://t.me/+ztpcqZ8sXdk0OWZl"},
  {"name":"WHITE PLAINS","link":"https://t.me/+JLK_JcQMJ4UxM2Vl"},
  {"name":"WOODSIDE HOMES","link":"https://t.me/+nGS0QD9n59RkY2Jl"},
  {"name":"XAVIERVILLE","link":"https://t.me/+tjIEr8piM9M3MDZl"}
];

async function run() {
  console.log('🚀 Starting Telegram Groups Bulk Import...');
  
  // Format data for insertion
  const toInsert = groups.map(g => ({
    name: g.name,
    invite_link: g.link,
    // Add name as the first keyword by default
    keywords: [g.name],
    is_active: true
  }));

  const { data, error } = await supabase
    .from('luxe_telegram_groups')
    .upsert(toInsert, { onConflict: 'name' });

  if (error) {
    console.error('❌ Error inserting groups:', error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully imported ${groups.length} groups!`);
}

run();
