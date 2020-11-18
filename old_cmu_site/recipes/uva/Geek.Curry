From asr4u Fri Jan 27 15:54:03 1995
Date: Fri, 27 Jan 95 15:54:03 EST
From: asr4u (Ari Rapkin)
To: sam3a, mjc4y, jes2u@virginia.edu, an4m
Subject: yummmmy!

------- start of forwarded message (RFC 934 encapsulation) -------
From: adam@cs.caltech.edu (Adam Rifkin)
To: asr4u@uvacs.cs.virginia.edu
Subject: If this isn't ultrageeking, what is?
Date: Fri, 27 Jan 95 12:49:55 PST


Subject: Recipe For Curry (The Modern Version)

/*--------------------------------------------------------------------
* EZ Indian Curry Recipe, v3.0
*    Cook at your own risk. Not accountable for charred pans,
*    upset stomachs, numbed taste buds and enraged dinner guests.
*    Unauthorized copying is widely encouraged ;-)
*-------------------------------------------------------------------*/

#include <CookingOil>
#include <Onions>
#include <GreenPepper>
#include <Ginger>
#include <CurryPowder>
#include <TurmericPowder>
#include <Salt>

/*-------------------------------------------------------------------
* All the ingredients are available at your friendly neigbourhood
* grocery store. No matter who you are, you'll find it at Freddy's;
* or Safeway, what a neighbour should be (do try your neighbour too).
*
* I use Crisco cooking oil, big white onions, thin green peppers
* Curry Powder by Spice Islands, and Ground Turmeric by Schilling,
* both are available in the spice racks of the above grocery stores,
* and Morton Iodized salt.
*-------------------------------------------------------------------*/

#ifdef InExtremeHurry
#include <FrozenVegetablePack>
#else
#include <FreshVegetables>
#endif

main(ac, av)
int   ac;
char  **av;
{
Vessels         CookingPan, Ladel, Lid; /* Preferrably NonStick*/
Tools           CuttingBoard, Knife;

signal(Smoke, SmokeAlarm);

/* Preparation */

switch(WhichCurry) {

case MixedVegetable:
if (ExtremelyLazy || InGreatHurry) {
Choose(OrientalVegetables || /* my favorite */
MixedVegetables ||CalifornianMix);
CuttingBoard = Thaw(FrozenPack);
}
else {
CuttingBoard = ScavengeFridge(AllVegetablesInSight);
Chop(BigPieces, AllVegetables);
}
break;

case EggPlant:  /* big */
CuttingBoard = EggPlant;
/* Cut into big chunks; EggPlant shrinks as it fries */
CuttingBoard += Cut(3*Logitudinal*Pieces, EggPlant);
for (each big piece) {
Make(3 longitudinal cuts);
Make (10 cuts across);
}
break;

default:
Look(YellowPages, IndianRestaurants);
exit(house);
}

Chop(SmallPieces, onion);         /* one big one */
Chop(FinePieces, 2*GreenPepper);  /* if you hate your dinner guests*/
/* be liberal with Green Peppers */
Chop(MicroPieces, UltraThinSlice(Ginger));

/* Actual Cooking */

CookingPan = 3*Spoon*CookingOil;  /* gently spread thin layer */
if (WhichCurry == EggPlant)       /* EggPlant absorbs lots of oil */
CookingPan *= 2;

CookingPan += Chopped Onion;      /* spread evenly */

Heat(CookingPan, Medium);         /* MediumHi, if impatient */
while (Onions != LightBrown) {    /* usually 5 minutes */
Stir (occasionally);
Watch (TV);
}

/* Add all other ingredients */
CookingPan += GreenPeppers + Ginger + Vegetables;

CookingPan += 1*spoon*salt;
CookingPan += 1*spoon*CurryPowder;
CookingPan += 1*pinch*Turmeric;

while (Vegetables != VeryTender)    /* Usually 10 minutes */
Stir (ModeratelyVigorously);

/* If EggPlant, wait till it loses shape and becomes very soft */

if (Smell==Great && Taste==Good) {
Mail(kk_moorthy, Compliments);
return Curry;
}
else {
Spare(Me);
Call(PizzaHut);
exit(2);
}

/*----------------------------------------------------------*
* Depending on the market reaction for this program,
* free upgrades would soon be forthcoming.
* Free support is available at the above mail alias.
* Feel free to report bugs and caveats.
*----------------------------------------------------------*/

}

To Compile
$ cc -o NicePlate curry.c
To Run
$ curry | rice | mouths | more
------- end -------


 -=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-
   Ari Rapkin              +   How can we have wondered about so much  
   rapunzel@virginia.edu   +   for so long, and received so few answers?
 -=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-=+=-  the Judybats -=+=-=+=-=+=-

