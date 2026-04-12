/**
 * IATA to ICAO airport code mapping for major airports served by MCT.
 * Used by the official MCT flight data fetcher to map airport codes
 * from the HTML schedule pages.
 */

export const IATA_TO_ICAO = {
  // Middle East
  DXB: "OMDB",  // Dubai
  AUH: "OMAA",  // Abu Dhabi
  DOH: "OTHH",  // Doha
  SHJ: "OMSJ",  // Sharjah
  BAH: "OBBI",  // Bahrain
  KWI: "OKBK",  // Kuwait
  RUH: "OERK",  // Riyadh
  JED: "OEJN",  // Jeddah
  DMM: "OEDF",  // Dammam
  MED: "OEMA",  // Medina
  AHB: "OEAB",  // Abha
  ELQ: "OEGS",  // Gassim
  GIZ: "OEGN",  // Jazan
  HAS: "OEHL",  // Hail
  AJF: "OESK",  // Al Jawf
  AQI: "OEPA",  // Al Qaisumah
  BHH: "OEBH",  // Bisha
  DWD: "OEDW",  // Dawadmi
  EAM: "OENE",  // Najran
  EJH: "OEWJ",  // Wedjh
  GIZ: "OEGN",  // Jazan
  HOF: "OEAH",  // Hofuf
  OHS: "OESH",  // Sharurah
  RAE: "OERK",  // Arar
  TIF: "OETF",  // Taif
  TUI: "OETU",  // Turaif
  WAE: "OEWD",  // Wadi Al Dawasir
  YNB: "OEYN",  // Yanbu
  MCT: "OOMS",  // Muscat
  SLL: "OOSA",  // Salalah
  OHS: "OOSH",  // Sohar (note: may be different)
  DQM: "OODQ",  // Duqm
  KHS: "OOKB",  // Khasab
  FJR: "OMFJ",  // Fujairah
  RKT: "OMRK",  // Ras Al Khaimah
  AAN: "OMAL",  // Al Ain

  // India (South Asia)
  BOM: "VABB",  // Mumbai
  DEL: "VIDP",  // Delhi
  MAA: "VOMM",  // Chennai
  BLR: "VOBL",  // Bangalore
  HYD: "VOHS",  // Hyderabad
  COK: "VOCI",  // Kochi
  TRV: "VOTV",  // Thiruvananthapuram
  CCJ: "VOCL",  // Kozhikode
  CNN: "VOCI",  // Kannur (note: may be different)
  PNQ: "VAPO",  // Pune
  AMD: "VAAH",  // Ahmedabad
  JAI: "VIJP",  // Jaipur
  LKO: "VILK",  // Lucknow
  IXE: "VOML",  // Mangalore
  IXC: "VICG",  // Chandigarh
  ATQ: "VIAR",  // Amritsar
  IXJ: "VIJU",  // Jammu
  SXR: "VISR",  // Srinagar
  GAU: "VEGT",  // Guwahati
  CCU: "VECC",  // Kolkata
  PAT: "VEPT",  // Patna
  BBI: "VEBS",  // Bhubaneswar
  VNS: "VIBN",  // Varanasi
  GOI: "VOGO",  // Goa
  NAG: "VANP",  // Nagpur
  IND: "VAID",  // Indore
  BDQ: "VABO",  // Vadodara
  STV: "VASU",  // Surat

  // Pakistan
  KHI: "OPKC",  // Karachi
  LHE: "OPLA",  // Lahore
  ISB: "OPIS",  // Islamabad
  PEW: "OPPS",  // Peshawar
  MUX: "OPMT",  // Multan
  SKT: "OPST",  // Sialkot
  UET: "OPQT",  // Quetta
  RYK: "OPRK",  // Rahim Yar Khan
  PSI: "OPPS",  // Pasni
  TUK: "OPKC",  // Turbat

  // Bangladesh
  DAC: "VGHS",  // Dhaka
  CGP: "VGEG",  // Chittagong

  // Sri Lanka
  CMB: "VCBI",  // Colombo
  HRI: "VCRI",  // Hambantota

  // Nepal
  KTM: "VNKT",  // Kathmandu

  // Maldives
  MLE: "VRMM",  // Male

  // Europe
  LHR: "EGLL",  // London Heathrow
  LGW: "EGKK",  // London Gatwick
  MAN: "EGCC",  // Manchester
  STN: "EGSS",  // London Stansted
  CDG: "LFPG",  // Paris
  FRA: "EDDF",  // Frankfurt
  MUC: "EDDM",  // Munich
  AMS: "EHAM",  // Amsterdam
  FCO: "LIRF",  // Rome
  MXP: "LIMC",  // Milan
  MAD: "LEMD",  // Madrid
  BCN: "LEBL",  // Barcelona
  ZRH: "LSZH",  // Zurich
  GVA: "LSGG",  // Geneva
  VIE: "LOWW",  // Vienna
  CPH: "EKCH",  // Copenhagen
  ARN: "ESSA",  // Stockholm
  OSL: "ENGM",  // Oslo
  HEL: "EFHK",  // Helsinki
  DUB: "EIDW",  // Dublin
  BRU: "EBBR",  // Brussels
  PRG: "LKPR",  // Prague
  WAW: "EPWA",  // Warsaw
  BUD: "LHBP",  // Budapest
  ATH: "LGAV",  // Athens
  IST: "LTFM",  // Istanbul
  SAW: "LTFJ",  // Istanbul Sabiha
  ADB: "LTBJ",  // Izmir
  AYT: "LTAI",  // Antalya
  LCA: "LCLK",  // Larnaca
  PFO: "LCPH",  // Paphos

  // Asia-Pacific
  BKK: "VTBS",  // Bangkok
  HKT: "VTSP",  // Phuket
  SIN: "WSSS",  // Singapore
  KUL: "WMKK",  // Kuala Lumpur
  CGK: "WIII",  // Jakarta
  MNL: "RPLL",  // Manila
  HKG: "VHHH",  // Hong Kong
  CAN: "ZGGG",  // Guangzhou
  PVG: "ZSPD",  // Shanghai
  PEK: "ZBAA",  // Beijing
  NRT: "RJAA",  // Tokyo Narita
  HND: "RJTT",  // Tokyo Haneda
  ICN: "RKSI",  // Seoul
  TPE: "RCTP",  // Taipei
  SYD: "YSSY",  // Sydney
  MEL: "YMML",  // Melbourne
  PER: "YPPH",  // Perth

  // Africa
  CAI: "HECA",  // Cairo
  JNB: "FAOR",  // Johannesburg
  CPT: "FACT",  // Cape Town
  ADD: "HAAB",  // Addis Ababa
  NBO: "HKJK",  // Nairobi
  DAR: "HTDA",  // Dar es Salaam
  ZNZ: "HTZA",  // Zanzibar
  KRT: "HSSS",  // Khartoum
  KGL: "HRYR",  // Kigali
  EBB: "HUEN",  // Entebbe

  // Americas
  JFK: "KJFK",  // New York
  EWR: "KEWR",  // Newark
  LAX: "KLAX",  // Los Angeles
  ORD: "KORD",  // Chicago
  YYZ: "CYYZ",  // Toronto
};

/**
 * Convert IATA code to ICAO code.
 * Returns null if not found in the mapping.
 */
export function iataToIcao(iata) {
  if (!iata) return null;
  const normalized = iata.toUpperCase().trim();
  return IATA_TO_ICAO[normalized] || null;
}
