// A curated reference list of commonly stocked Indian pharmacy medicines, used only to
// quick-fill the Add Medicine form (name/brand/company/category/pack/HSN/GST). This is a
// static, bundled dataset for convenience — not a live feed from any external market/drug
// database — so pricing, batch and stock fields are intentionally left out; those are always
// specific to what the pharmacy actually purchased.
export type MedicineCatalogItem = {
  name: string;
  brand: string;
  company: string;
  category: string;
  pack: string;
  hsnCode: string;
  gstPercent: number;
};

const HSN = "3004";

export const MEDICINE_CATALOG: MedicineCatalogItem[] = [
  // Tablets
  { name: "Paracetamol 500", brand: "Crocin", company: "GSK", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 12 },
  { name: "Paracetamol 650", brand: "Dolo 650", company: "Micro Labs", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ibuprofen 400", brand: "Brufen 400", company: "Abbott", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Diclofenac 50", brand: "Voveran 50", company: "Novartis", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Aceclofenac 100", brand: "Zerodol", company: "Ipca Labs", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Nimesulide 100", brand: "Nise", company: "Dr. Reddy's", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Aspirin 75", brand: "Ecosprin 75", company: "USV", category: "Tablet", pack: "14s", hsnCode: HSN, gstPercent: 12 },
  { name: "Paracetamol + Diclofenac", brand: "Combiflam", company: "Sanofi", category: "Tablet", pack: "20s", hsnCode: HSN, gstPercent: 12 },
  { name: "Azithromycin 500", brand: "Azithral 500", company: "Alembic", category: "Tablet", pack: "3s", hsnCode: HSN, gstPercent: 12 },
  { name: "Amoxicillin 500", brand: "Mox 500", company: "Ranbaxy", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Amoxicillin + Clavulanate 625", brand: "Augmentin 625 Duo", company: "GSK", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ciprofloxacin 500", brand: "Ciplox 500", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Levofloxacin 500", brand: "Glevo 500", company: "Glenmark", category: "Tablet", pack: "5s", hsnCode: HSN, gstPercent: 12 },
  { name: "Metronidazole 400", brand: "Flagyl 400", company: "Abbott", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Doxycycline 100", brand: "Doxy 1", company: "Aristo Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Cefixime 200", brand: "Taxim-O 200", company: "Alkem", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Omeprazole 20", brand: "Omez", company: "Dr. Reddy's", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Pantoprazole 40", brand: "Pan 40", company: "Alkem", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Rabeprazole 20", brand: "Rablet 20", company: "Lupin", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ranitidine 150", brand: "Rantac 150", company: "JB Chemicals", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Domperidone 10", brand: "Vomistop", company: "Torrent Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ondansetron 4", brand: "Emeset 4", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Cetirizine 10", brand: "Cetzine", company: "GSK", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Levocetirizine 5", brand: "Levorid", company: "Aristo Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Fexofenadine 120", brand: "Allegra 120", company: "Sanofi", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Chlorpheniramine 4", brand: "Piriton", company: "GSK", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Montelukast 10", brand: "Montair 10", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Montelukast + Levocetirizine", brand: "Montair LC", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Amlodipine 5", brand: "Amlong 5", company: "Micro Labs", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Atenolol 50", brand: "Aten 50", company: "Cipla", category: "Tablet", pack: "14s", hsnCode: HSN, gstPercent: 12 },
  { name: "Losartan 50", brand: "Losar 50", company: "Unichem", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Telmisartan 40", brand: "Telma 40", company: "Glenmark", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 12 },
  { name: "Metoprolol 50", brand: "Metolar XR 50", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Atorvastatin 10", brand: "Atorva 10", company: "Zydus Cadila", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Rosuvastatin 10", brand: "Rosuvas 10", company: "Sun Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Metformin 500", brand: "Glycomet 500", company: "USV", category: "Tablet", pack: "20s", hsnCode: HSN, gstPercent: 12 },
  { name: "Metformin + Glimepiride", brand: "Glimestar M1", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Glimepiride 2", brand: "Amaryl 2", company: "Sanofi", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 12 },
  { name: "Voglibose 0.3", brand: "Volibo 0.3", company: "Sun Pharma", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 12 },
  { name: "Levothyroxine 50mcg", brand: "Thyronorm 50", company: "Abbott", category: "Tablet", pack: "100s", hsnCode: HSN, gstPercent: 12 },
  { name: "Prednisolone 10", brand: "Wysolone 10", company: "Pfizer", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Alprazolam 0.25", brand: "Alprax 0.25", company: "Torrent Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Clonazepam 0.5", brand: "Lonazep 0.5", company: "Sun Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Escitalopram 10", brand: "Nexito 10", company: "Sun Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Sertraline 50", brand: "Zoloft 50", company: "Pfizer", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Calcium + Vitamin D3", brand: "Shelcal 500", company: "Torrent Pharma", category: "Tablet", pack: "15s", hsnCode: HSN, gstPercent: 5 },
  { name: "Vitamin D3 60000IU", brand: "Uprise D3", company: "Alkem", category: "Tablet", pack: "4s", hsnCode: HSN, gstPercent: 5 },
  { name: "Folic Acid 5", brand: "Folvite 5", company: "Sanofi", category: "Tablet", pack: "20s", hsnCode: HSN, gstPercent: 12 },
  { name: "Iron + Folic Acid", brand: "Fefol", company: "GSK", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ivermectin 12", brand: "Ivecop 12", company: "Ipca Labs", category: "Tablet", pack: "4s", hsnCode: HSN, gstPercent: 12 },
  { name: "Albendazole 400", brand: "Zentel 400", company: "GSK", category: "Tablet", pack: "1s", hsnCode: HSN, gstPercent: 12 },
  { name: "Loperamide 2", brand: "Eldoper 2", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Hydroxychloroquine 200", brand: "HCQS 200", company: "Ipca Labs", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Tamsulosin 0.4", brand: "Urimax 0.4", company: "Cipla", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Pregabalin 75", brand: "Pregeb 75", company: "Sun Pharma", category: "Tablet", pack: "10s", hsnCode: HSN, gstPercent: 12 },

  // Capsules
  { name: "Amoxicillin 500", brand: "Novamox 500", company: "Cipla", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Doxycycline 100", brand: "Doxy 1 Capsule", company: "Aristo Pharma", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Omeprazole + Domperidone", brand: "Omez-D", company: "Dr. Reddy's", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Rabeprazole + Domperidone", brand: "Rablet-D", company: "Lupin", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Esomeprazole 40", brand: "Nexpro 40", company: "Torrent Pharma", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Fluconazole 150", brand: "Forcan 150", company: "Cipla", category: "Capsule", pack: "1s", hsnCode: HSN, gstPercent: 12 },
  { name: "Itraconazole 100", brand: "Sporanox 100", company: "Janssen", category: "Capsule", pack: "4s", hsnCode: HSN, gstPercent: 12 },
  { name: "Ampicillin + Cloxacillin", brand: "Ampiclox", company: "Ranbaxy", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Vitamin E 400", brand: "Evion 400", company: "Merck", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 5 },
  { name: "Multivitamin + Multimineral", brand: "Revital H", company: "Sun Pharma", category: "Capsule", pack: "30s", hsnCode: HSN, gstPercent: 5 },
  { name: "Vitamin B-Complex", brand: "Becosules", company: "Pfizer", category: "Capsule", pack: "20s", hsnCode: HSN, gstPercent: 5 },
  { name: "Cinnarizine + Domperidone", brand: "Stugeron-DM", company: "Sun Pharma", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Tinidazole 500", brand: "Tiniba", company: "Cipla", category: "Capsule", pack: "4s", hsnCode: HSN, gstPercent: 12 },
  { name: "Gemfibrozil 300", brand: "Lipicard 300", company: "Cipla", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },
  { name: "Evening Primrose Oil", brand: "Evecare", company: "Himalaya", category: "Capsule", pack: "10s", hsnCode: HSN, gstPercent: 12 },

  // Syrups
  { name: "Paracetamol Syrup", brand: "Crocin Syrup", company: "GSK", category: "Syrup", pack: "60ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Dextromethorphan Cough Syrup", brand: "Benadryl", company: "Johnson & Johnson", category: "Syrup", pack: "100ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Ambroxol Syrup", brand: "Mucolite", company: "Cipla", category: "Syrup", pack: "100ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Cetirizine Syrup", brand: "Cetzine Syrup", company: "GSK", category: "Syrup", pack: "60ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Amoxicillin Syrup", brand: "Novamox Syrup", company: "Cipla", category: "Syrup", pack: "30ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Azithromycin Syrup", brand: "Azithral Syrup", company: "Alembic", category: "Syrup", pack: "15ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Iron Tonic Syrup", brand: "Dexorange Syrup", company: "FDC", category: "Syrup", pack: "200ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Multivitamin Syrup", brand: "Zincovit Syrup", company: "Apex Labs", category: "Syrup", pack: "200ml", hsnCode: HSN, gstPercent: 5 },
  { name: "Domperidone Syrup", brand: "Vomistop Syrup", company: "Torrent Pharma", category: "Syrup", pack: "30ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Ondansetron Syrup", brand: "Emeset Syrup", company: "Cipla", category: "Syrup", pack: "30ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Lactulose Syrup", brand: "Duphalac", company: "Abbott", category: "Syrup", pack: "200ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Levocetirizine Syrup", brand: "Levorid Syrup", company: "Aristo Pharma", category: "Syrup", pack: "60ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Salbutamol Syrup", brand: "Asthalin Syrup", company: "Cipla", category: "Syrup", pack: "100ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Calcium Syrup", brand: "Shelcal Syrup", company: "Torrent Pharma", category: "Syrup", pack: "200ml", hsnCode: HSN, gstPercent: 5 },
  { name: "Cyproheptadine Syrup", brand: "Practin Syrup", company: "Sun Pharma", category: "Syrup", pack: "100ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Paracetamol Drops", brand: "Crocin Drops", company: "GSK", category: "Syrup", pack: "15ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Cefpodoxime Syrup", brand: "Cepodem Syrup", company: "Alkem", category: "Syrup", pack: "30ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Diclofenac + Paracetamol Syrup", brand: "Combiflam Syrup", company: "Sanofi", category: "Syrup", pack: "60ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Antacid Syrup", brand: "Digene Gel", company: "Abbott", category: "Syrup", pack: "170ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Pantoprazole Syrup", brand: "Pan Syrup", company: "Alkem", category: "Syrup", pack: "30ml", hsnCode: HSN, gstPercent: 12 },

  // Injections
  { name: "Ceftriaxone 1g Injection", brand: "Monocef 1g", company: "Aristo Pharma", category: "Injection", pack: "1 vial", hsnCode: HSN, gstPercent: 12 },
  { name: "Diclofenac Injection", brand: "Voveran Injection", company: "Novartis", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Insulin Glargine", brand: "Lantus", company: "Sanofi", category: "Injection", pack: "1 vial", hsnCode: HSN, gstPercent: 5 },
  { name: "Insulin Human Mixtard 30", brand: "Mixtard 30", company: "Novo Nordisk", category: "Injection", pack: "1 vial", hsnCode: HSN, gstPercent: 5 },
  { name: "Tetanus Toxoid Injection", brand: "TT Vaccine", company: "Serum Institute of India", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Dexamethasone Injection", brand: "Decdan Injection", company: "Zydus Cadila", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Vitamin B12 Injection", brand: "Methycobal Injection", company: "Eisai", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Ranitidine Injection", brand: "Rantac Injection", company: "JB Chemicals", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Ondansetron Injection", brand: "Emeset Injection", company: "Cipla", category: "Injection", pack: "1 amp", hsnCode: HSN, gstPercent: 12 },
  { name: "Amikacin Injection", brand: "Mikacin", company: "Alkem", category: "Injection", pack: "1 vial", hsnCode: HSN, gstPercent: 12 },

  // Ointments / Creams
  { name: "Betamethasone Cream", brand: "Betnovate", company: "GSK", category: "Cream", pack: "20g", hsnCode: HSN, gstPercent: 12 },
  { name: "Clotrimazole Cream", brand: "Candid Cream", company: "Glenmark", category: "Cream", pack: "20g", hsnCode: HSN, gstPercent: 12 },
  { name: "Mupirocin Ointment", brand: "T-Bact", company: "GSK", category: "Ointment", pack: "5g", hsnCode: HSN, gstPercent: 12 },
  { name: "Silver Sulfadiazine Cream", brand: "Silverex", company: "Glenmark", category: "Cream", pack: "20g", hsnCode: HSN, gstPercent: 12 },
  { name: "Diclofenac Gel", brand: "Voveran Gel", company: "Novartis", category: "Ointment", pack: "30g", hsnCode: HSN, gstPercent: 12 },
  { name: "Neomycin + Framycetin", brand: "Soframycin", company: "Sanofi", category: "Ointment", pack: "20g", hsnCode: HSN, gstPercent: 12 },
  { name: "Fusidic Acid Cream", brand: "Fucidin", company: "Leo Pharma", category: "Cream", pack: "5g", hsnCode: HSN, gstPercent: 12 },
  { name: "Permethrin Cream", brand: "Scabimite", company: "Encore Healthcare", category: "Cream", pack: "30g", hsnCode: HSN, gstPercent: 12 },
  { name: "Terbinafine Cream", brand: "Terbicip Cream", company: "Cipla", category: "Cream", pack: "10g", hsnCode: HSN, gstPercent: 12 },
  { name: "Calamine Lotion", brand: "Caladryl", company: "Johnson & Johnson", category: "Cream", pack: "60ml", hsnCode: HSN, gstPercent: 12 },

  // Drops
  { name: "Ciprofloxacin Eye Drops", brand: "Ciplox Eye Drops", company: "Cipla", category: "Drops", pack: "5ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Sodium Chloride Nasal Drops", brand: "Nasoclear", company: "Cipla", category: "Drops", pack: "10ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Chloramphenicol Eye Drops", brand: "Chlorocol", company: "Warren Pharma", category: "Drops", pack: "5ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Olopatadine Eye Drops", brand: "Patanol", company: "Alcon", category: "Drops", pack: "5ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Xylometazoline Nasal Drops", brand: "Otrivin", company: "GSK", category: "Drops", pack: "10ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Ciprofloxacin + Dexamethasone Ear Drops", brand: "Ciplox-D Ear Drops", company: "Cipla", category: "Drops", pack: "5ml", hsnCode: HSN, gstPercent: 12 },
  { name: "Vitamin D3 Drops", brand: "Uprise D3 Drops", company: "Alkem", category: "Drops", pack: "15ml", hsnCode: HSN, gstPercent: 5 },
  { name: "Gripe Water", brand: "Woodward's Gripe Water", company: "Johnson & Johnson", category: "Drops", pack: "130ml", hsnCode: HSN, gstPercent: 12 },

  // Powders
  { name: "Oral Rehydration Salts", brand: "Electral", company: "FDC", category: "Powder", pack: "21g sachet", hsnCode: HSN, gstPercent: 5 },
  { name: "Ispaghula Husk", brand: "Fybogel", company: "Reckitt Benckiser", category: "Powder", pack: "100g", hsnCode: HSN, gstPercent: 12 },
  { name: "Protein Supplement Powder", brand: "Protinex", company: "Danone", category: "Powder", pack: "200g", hsnCode: HSN, gstPercent: 12 },
  { name: "Clotrimazole Dusting Powder", brand: "Candid Dusting Powder", company: "Glenmark", category: "Powder", pack: "100g", hsnCode: HSN, gstPercent: 12 },
  { name: "Talc Powder", brand: "Johnson's Baby Powder", company: "Johnson & Johnson", category: "Powder", pack: "100g", hsnCode: HSN, gstPercent: 12 },

  // Inhalers
  { name: "Salbutamol Inhaler", brand: "Asthalin Inhaler", company: "Cipla", category: "Inhaler", pack: "200 MDI", hsnCode: HSN, gstPercent: 12 },
  { name: "Budesonide + Formoterol Inhaler", brand: "Foracort Inhaler", company: "Cipla", category: "Inhaler", pack: "200 MDI", hsnCode: HSN, gstPercent: 12 },
  { name: "Levosalbutamol Inhaler", brand: "Levolin Inhaler", company: "Cipla", category: "Inhaler", pack: "200 MDI", hsnCode: HSN, gstPercent: 12 },
  { name: "Beclomethasone Inhaler", brand: "Clenil Inhaler", company: "Cipla", category: "Inhaler", pack: "200 MDI", hsnCode: HSN, gstPercent: 12 },
];
