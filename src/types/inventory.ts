export interface Vehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string;
  drivetrain: string;
  transmission: string;
  fuel_type: string;
  exterior_color: string;
  price: number;
  mileage: number;
  stock_number: string;
  status: 'available' | 'draft' | 'pending' | 'reserved' | 'sold' | 'archived';
  photo: string;
  description?: string;
}

export const INVENTORY_PROTOTYPE: Vehicle[] = [
  {
    id: 1,
    year: 2022,
    make: "Honda",
    model: "CR-V",
    trim: "EX-L",
    body_style: "VUS",
    drivetrain: "AWD",
    transmission: "automatique",
    fuel_type: "essence",
    exterior_color: "rouge",
    price: 32995,
    mileage: 41200,
    stock_number: "L2201",
    status: "available",
    photo: "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?auto=format&fit=crop&w=800&q=80",
    description: "Honda CR-V EX-L 2022 en superbe condition. Équipé de la traction intégrale AWD, toit ouvrant panoramique, sellerie en cuir avec sièges chauffants avant et arrière, hayon électrique, caméra de recul et suite de sécurité active Honda Sensing. Historique d'entretien complet chez le concessionnaire."
  },
  {
    id: 2,
    year: 2021,
    make: "Toyota",
    model: "RAV4",
    trim: "XLE",
    body_style: "VUS",
    drivetrain: "AWD",
    transmission: "automatique",
    fuel_type: "essence",
    exterior_color: "noir",
    price: 29950,
    mileage: 53800,
    stock_number: "L2108",
    status: "available",
    photo: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80",
    description: "Toyota RAV4 XLE AWD 2021 noir d'une fiabilité exemplaire. Traction intégrale dynamique, volant chauffant, démarrage par bouton-poussoir, connectivité Apple CarPlay et Android Auto, ainsi que le système Toyota Safety Sense 2.0."
  },
  {
    id: 3,
    year: 2020,
    make: "Mazda",
    model: "CX-5",
    trim: "GT",
    body_style: "VUS",
    drivetrain: "AWD",
    transmission: "automatique",
    fuel_type: "essence",
    exterior_color: "gris",
    price: 27400,
    mileage: 62110,
    stock_number: "L2044",
    status: "available",
    photo: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80",
    description: "Mazda CX-5 GT 2020 i-ACTIV AWD de couleur gris météore. Finition haut de gamme avec chaîne audio Bose à 10 haut-parleurs, sièges ventilés en cuir Nappa, affichage tête haute projeté au pare-brise et roues en alliage de 19 pouces."
  },
  {
    id: 4,
    year: 2019,
    make: "Hyundai",
    model: "Elantra",
    trim: "Preferred",
    body_style: "berline",
    drivetrain: "FWD",
    transmission: "automatique",
    fuel_type: "essence",
    exterior_color: "blanc",
    price: 16995,
    mileage: 80440,
    stock_number: "L1933",
    status: "available",
    photo: "https://images.unsplash.com/photo-1590362891988-f7780470208b?auto=format&fit=crop&w=800&q=80",
    description: "Hyundai Elantra Preferred 2019 blanc polaire berline traction avant. Très économique en carburant, dotée de sièges et volant chauffants, caméra de recul avec lignes de guidage, régulateur de vitesse et écran tactile haute définition."
  },
  {
    id: 5,
    year: 2018,
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    body_style: "camion",
    drivetrain: "4x4",
    transmission: "automatique",
    fuel_type: "essence",
    exterior_color: "bleu",
    price: 28900,
    mileage: 97300,
    stock_number: "L1812",
    status: "available",
    photo: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80",
    description: "Camionnette Ford F-150 XLT 2018 SuperCrew 4x4 bleu foudre. Moteur EcoBoost vigoureux avec boîte automatique 10 vitesses, groupe de remorquage Max, boîte doublée par pulvérisation et marchepieds tubulaires. Prêt pour toutes les tâches."
  }
];
