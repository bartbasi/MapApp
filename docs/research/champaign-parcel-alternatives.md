# Champaign County parcels: lawful routes that do not depend on the consortium's licensed files

Researched 2026-11-18 from public web pages and documents only. Nothing was downloaded from any county or consortium service. No form was submitted, no login or click-through term was accepted, and no FOIA request was sent. No parcel owner is named here. This is research, not legal advice. Every point marked **LAWYER** needs a lawyer's eye before the owner acts on it.

## The result first

**No lawful route gives the app free, openly licensed parcel outlines for Champaign County today.** The outlines are the hard part. The owner name, parcel ID and acreage are much easier, because they sit in the county's assessment and tax database, which is not GIS data and which Illinois courts have ordered released at the cost of the disk.

The owner's distinction holds in one place and fails in another:

- It holds for the facts. That a parcel exists, where it is, and who owns it are public information. Nobody owns those facts, and the law and the cases all say so.
- It fails for the consortium's finished file of outlines. In 2022 the Illinois Appellate Court, Fourth District, held that a county may refuse to release its parcel outline file under the Freedom of Information Act, because the file is a "computer geographic system" and release would give the requester a "private gain" (*Hurlbert v. Edmonds*, below). The same court said a county may sell that file under a license that bars redistribution. So the county does not need copyright to protect its outline file. The Illinois statute does it.
- Plain PDF tax maps are different. The same case says the PDF versions of the county tax maps are public records that must be disclosed.

A correction to an earlier note: the consortium's own annual data download carries **only the parcel number** for each parcel, not owner name or acreage (Products page, read 2026-11-18). Even a signed license from the consortium would not by itself deliver the owner name or acreage the app wants. Those come from the Supervisor of Assessments.

### Ranked routes

**1. FOIA request to the Supervisor of Assessments (and, if needed, the Treasurer) for the property database: parcel ID, owner name, acreage. No outlines.**
- Gets: the tabular half of the job (owner, parcel ID, acreage, plus whatever else the office keeps, which the app must then drop).
- Cost: by statute only "the actual cost of purchasing the recording medium" unless the request is "for a commercial purpose" or "voluminous", in which case search and review time may be charged at up to $10 an hour after 8 free hours (5 ILCS 140/6(a), 6(f)). Likely under $100.
- Time: 5 business days, extendable by 5 more, for an ordinary request. 21 working days for a request for a commercial purpose (5 ILCS 140/3.1, summary only).
- Risk: low on the law. Two cases hold a county assessor must give the assessment file in electronic form at media cost (*Sage v. Humm*, *Sage v. Suhr*). Practical risk: the county has deliberately removed owner-name search from its public lookup, and a refusal on privacy grounds under section 7(1)(c) is possible, though weak for an owner name. A local news site says the entire property database can be had by FOIA, and it republished four or more years of it, so the office has released it before.
- The owner must: decide who signs the request, say honestly whether the use is commercial (see question 1), write the request, and handle any Public Access Counselor appeal (60 days from a denial). **LAWYER** on the commercial-purpose question.
- Limit: this alone does not draw a single line.

**2. Ask the county in writing for permission or a license that fits a free, open source app, or ask it to release the outline file as open data.**
- Gets: the outlines, if the county agrees.
- Cost: unknown. Prices are not posted. The consortium sells a one-year download subscription through its store.
- Time: weeks to months. The consortium is "a unit of the Lead Agency" (Champaign County), and its Policy Committee sets data sales and licensing policy (agreement text below), so the request goes to that committee, not to staff.
- Risk: the standard license bars redistribution outside the licensee's organization (unconfirmed wording, per the earlier note). A GPL app that ships parcels to the public cannot sit under that. The ask has to be for a specific written grant, for example "display and offline storage on end users' phones, with credit". Refusal is likely and lawful under *Hurlbert*.
- The owner must: write and sign the letter, attend or send someone to a Policy Committee meeting, and have a lawyer read any grant.
- This is the only route that gives true county outlines with a clear right to use them.

**3. FOIA request for the county tax maps in PDF form, then vectorize and georeference them.**
- Gets: parcel lines drawn on the county's tax map pages, if the PDFs hold vector lines.
- Cost: media cost, plus significant work. Nobody has said whether the PDF pages are vector or scanned images. Not found.
- Time: the request takes weeks. The tracing and georeferencing of about 80,000 parcels would take months, with much manual repair.
- Risk: legal risk is moderate. *Hurlbert* says the PDF maps are public. But the *Suffolk* case let a county keep copyright in its tax maps against a company that copied and sold them, so a county could claim the PDFs are protected even if it must hand them over. **LAWYER.** Accuracy risk is high: the pages are drawings, not survey data.
- The owner must: decide whether this is worth the engineering and the legal risk.

**4. Build a coarse layer from the Public Land Survey System, and add parcels from recorded plats only where needed.**
- Gets: township, section and quarter-section lines that are free to use. For large rural tracts this may be the right line. For everything else it is wrong.
- Cost: free data, real engineering for anything beyond sections.
- Risk: the Illinois State Geological Survey says its PLSS layer has "positional inaccuracy of up to 600 feet in some areas of the state", and the layer says it is not a legal base. I could find no measurement of how often east central Illinois property lines follow section or quarter-section lines, so that share is unknown.
- It is a fallback that gives hunters section lines, not property lines.

**5. Buy commercial parcel data. Not usable.** The one vendor whose terms I could read bars public display and redistribution (question 6). The owner has not agreed to spend money in any case.

**6. Do not use these.**
- The consortium's map service through its portal proxy, or any copy made from it. The OpenAddresses project lists a Champaign County "parcels" source that points at the consortium's proxy and sends a header that names the consortium's own map site as the referring page (question 4). That is not a license and the data carries no owner.
- Student copies of the consortium's data on ArcGIS Online, noted earlier.
- The free University of Illinois WebStore copy of the consortium geodatabase. It is offered only to university staff and students (question 3).

### Do the cheapest thing first

Route 1 costs almost nothing, can run in parallel with route 2, and tells the owner how this county treats a request. The owner can also send the FOIA for the shapefile. The expected answer is a refusal under *Hurlbert*, but a refusal costs nothing and can be appealed. It would also produce a written record from the county of which parts it will and will not release. The public body may still choose to release an exempt record. **LAWYER:** *Hurlbert* discusses waiver by selective release, so a county may be wary of releasing the file to one requester only.

---

## Question 1: Illinois Freedom of Information Act

### The statute (5 ILCS 140)

I could not open ilga.gov (certificate error on this machine). I read the statute text in the Illinois Attorney General's published copies of sections 2, 3, 6 and 7 (`illinoisattorneygeneral.gov/Page-Attachments/FOIAOMA-Training-Registration/5ILCS140s2.pdf`, `...s3.pdf`, `...s6.pdf`, `...s7.pdf`, read 2026-11-18). The copies were dated late 2025 or early 2026. Section 3.1 I read only in a FindLaw summary (`codes.findlaw.com/il/chapter-5-general-provisions/il-st-sect-5-140-3-1/`, read 2026-11-18), which warns it may lag the current law. Bills pending in the 2025-2026 session would change the definition of "commercial purpose" (SB2171 and others, seen in search results). Check the live text before filing. **LAWYER.**

**Who is covered.** Section 2(a): "'Public body' means all legislative, executive, administrative, or advisory bodies of the State, state universities and colleges, counties, townships, cities, villages, incorporated towns, school districts and all other municipal corporations, boards, bureaus, committees, or commissions of this State, any subsidiary bodies of any of the foregoing".

**What is covered.** Section 2(c) includes "maps" among public records (the list is "all records, reports, forms, writings, letters, memoranda, books, papers, maps, ..." per the FindLaw copy).

**The duty to release.** Section 3(a): "Each public body shall make available to any person for inspection or copying all public records, except as otherwise provided in Sections 7 and 8.5 of this Act. Notwithstanding any other law, a public body may not grant to any person or entity, whether by contract, license, or otherwise, the exclusive right to access and disseminate any public record as defined in this Act."

**Electronic form and fees.** Section 6(a): "the public body shall furnish it in the electronic format specified by the requester, if feasible." It continues: "A public body may charge the requester for the actual cost of purchasing the recording medium, whether disc, diskette, tape, or other medium. If a request is not a request for a commercial purpose or a voluminous request, a public body may not charge the requester for the costs of any search for and review of the records or other personnel costs associated with reproducing the records. Except to the extent that the General Assembly expressly provides, statutory fees applicable to copies of public records when furnished in a paper format shall not be applicable to those records when furnished in an electronic format." Section 6(f), for commercial requests only: "up to $10 for each hour spent by personnel in searching for and retrieving a requested record or examining the record for necessary redactions. No fees shall be charged for the first 8 hours".

**The commercial definition.** Section 2(c-10): "'Commercial purpose' means the use of any part of a public record or records, or information derived from public records, in any form for sale, resale, or solicitation or advertisement for sales or services. For purposes of this definition, requests made by news media and non-profit, scientific, or academic organizations shall not be considered to be made for a 'commercial purpose' when the principal purpose of the request is (i) to access and disseminate information concerning news and current or passing events, (ii) for articles of opinion or features of interest to the public, or (iii) for the purpose of academic, scientific, or public research or education."

**What a commercial label changes** (FindLaw summary of 3.1): the public body has 21 working days to respond and "may require the person to pay in full before copying"; the response must give an estimate of time and fees, deny under an exemption, call the request unduly burdensome, or provide the records; and "It is a violation of this Act for a person to knowingly obtain a public record for a commercial purpose" without saying so (the summary was cut off after "commercial purpose", so the exact wording is unconfirmed). Section 6(f) then lets the body charge staff time after 8 hours.

**Is a free app from a company a commercial purpose?** Uncertain. The definition turns on use "for sale, resale, or solicitation or advertisement for sales or services". A free, ad-free, account-free app does not sell or advertise. But the requester is a company, the app may sit next to paid products or the company's brand, and a county may read "information derived from public records" broadly. A non-profit or academic requester is carved out only when the principal purpose is research or education, which a hunting app does not obviously meet. I found no Illinois case or Attorney General opinion on a free app. The safe course is to state the intended use plainly in the request and accept the commercial procedure and fees. **LAWYER.**

**The exemptions that matter.**
- Section 7(1)(i): "Valuable formulae, computer geographic systems, designs, drawings, and research data obtained or produced by any public body when disclosure could reasonably be expected to produce private gain or public loss. The exemption for 'computer geographic systems' provided in this paragraph (i) does not extend to requests made by news media as defined in Section 2 of this Act when the requested information is not otherwise exempt and the only purpose of the request is to access and disseminate information regarding the health, safety, welfare, or legal rights of the general public." A company is not news media, so the proviso does not help.
- Section 7(1)(c): personal information whose release would be "a clearly unwarranted invasion of personal privacy", meaning information "highly personal or objectionable to a reasonable person" where the subject's privacy outweighs "any legitimate public interest". An owner's name on a property record is not obviously highly personal. I found no case holding it exempt.
- Section 2(c-5) lists "private information" (exempt under 7(1)(b)). It includes "home address" and "home or personal telephone numbers". It does not list owner name. This matches the project rule to keep only outline, parcel ID, acreage and owner name and never take addresses or phone numbers. A mailing address in the assessment file is likely protected as a home address. **LAWYER.**

### The cases

I could not open the full text of most opinions. For each I say what I actually read.

**Hurlbert v. Edmonds, 2022 IL App (4th) 220204 (Nov. 30, 2022).** Read in the FindLaw copy (`caselaw.findlaw.com/court/il-court-of-appeals/2062750.html`, read 2026-11-18) as summarized by the fetch tool with paragraph numbers, plus two law-firm summaries. Not read from the court's own PDF (the court's server returned "File not found").
- Facts: the requester (the same Sage that sued in the earlier cases) asked a county assessment officer for the county tax map file for all parcels "in shapefile or similar format, not PDF". The county refused under section 7(1)(i). The request covered parcel boundaries and identifying traits, not other layers.
- Holding: affirmed for the county. Paragraph 19: "the term 'computer geographic systems' includes data stored in such a system." The PDF maps were "undisputed" public records. The shapefile functionality made it more valuable, and the county spends about $200,000 a year on its GIS. The requester did not contest the finding of reasonably expected private gain, so the court did not test it.
- License waiver: the county had earlier released the GIS data under a license that "prohibits the reproduction and redistribution of the GIS data", for a fee. The court held there was no waiver, reasoning that "no public loss would occur from the disclosure under the licensing agreement". In dicta it said a fee would not be inconsistent with the Act because licensees "have essentially agreed to not use the valuable GIS data for personal gain".
- Fees: the user-fee challenge was held forfeited.
- Why it matters most: it is a published Illinois appellate holding squarely on county parcel outline files. It goes against the owner's hope that a FOIA request can get the outlines. Whether Champaign County is within the Fourth District's reach as binding authority: the search results confirm Champaign was in the Fourth District before the 2021 redistricting and that the Fourth District now hears appeals from 41 counties (`illinoiscourts.gov/courts/appellate-court/districts-fourth-district`). I did not confirm Champaign's current placement. A published Illinois appellate opinion binds trial courts statewide unless another district disagrees. **LAWYER.**
- What it does not decide: whether a release for a free, open purpose would be "private gain" (the point was not contested), and whether a county could be forced to release outlines in a non-GIS form.

**Sage Information Services v. Humm, 2012 IL App (5th) 110580.** The court reversed a circuit court and ordered the county assessor to give the current real property assessment records on disc at no more than the cost of the media. Read in a search summary only (the court's PDF would not decode).

**Sage Information Services v. Suhr, 2014 IL App (2d) 130708.** Winnebago County's assessor wanted $6,290.45, five cents a parcel, for the countywide assessment file. Held: the Property Tax Code's "reasonable fee" does not override FOIA for electronic records. Quote reported by a municipal law blog (`municipalminute.ancelglink.com/2014/04/fee-for-electronic-records-excessive.html`): "Section 6 of FOIA prohibits a fee for reproduction of electronic records in excess of the cost of the electronic medium." Neither summary mentions a GIS exemption, so these two cases are about the tabular assessment file, which is route 1.

**Sage Information Services v. King, 391 Ill. App. 3d 1023 (2d Dist. 2009).** A DuPage County clerk wanted $5,500 for assessment data and called part of it exempt as "Private Gain" and "GIS Information". The court reversed a dismissal and found the fee unreasonable. Later cases say its fee reasoning was superseded by the 2010 FOIA amendment. Read in a search summary only.

**Public Access Counselor.** The Attorney General's index of binding opinions (read from the downloaded PDF, current to 2026) has one entry under 7(1)(i), on lease terms for public property (14-016, 2014). I found no binding opinion on GIS or parcel data. I did not search the non-binding review letters. Two 2025 opinions (25-013, 25-014) concern fees for redactions and are not relevant to GIS.

**Does a FOIA release carry a redistribution limit?** The statute itself imposes none. Section 3(a) forbids a body from giving anyone an exclusive right to disseminate a public record. Records that the body must release are not licensed. Records that the body may withhold under 7(1)(i) can be released only on the body's terms, and *Hurlbert* treats a fee-and-license release as a different thing from a FOIA release. Whether a county may condition a FOIA release itself on a license is not decided in any Illinois case I found. In South Carolina the state supreme court said that signing the county's license "was a prerequisite to the production of the data" (*Seago*, below). In California a court said there was "no statutory basis ... for conditioning its release on a licensing agreement" (*Santa Clara*). **LAWYER.**

### The consortium as a public body, and its members

- **Public body: yes, very likely.** The 2022 amended intergovernmental agreement (in the County Board packet for 2022-12-19, `champaigncountyil.gov/CountyBoard/CB/2022/221219_Special_Meeting/221219AgendaFull.pdf`, read 2026-11-18 by extracting the PDF text) says in section 2(b): "The Consortium shall be a unit of the Lead Agency, subject to the Lead Agency's policies and procedures". The Lead Agency is Champaign County. A unit of a county is within "counties ... any subsidiary bodies".
- **Section 10(c) of that agreement:** "In the event that the Consortium receives a FOIA request which seeks data owned by a Member, the Consortium shall respond to the said FOIA in accordance with FOIA, and notify the appropriate Policy Committee representatives of FOIA request and response." So the consortium itself expects FOIA requests. Section 10(d)(1) says its protocols "will allow disclosure of data in GIS to third Parties required by ... the Freedom of Information Act".
- **Who owns what.** Section 10(b): "Data supplied by individual Members shall continue to be owned by the individual Member". "The Consortium shall own GIS data which the Consortium develops through processing or altering of the original configuration of the data by the Consortium software." Section 8(d): a Member shall "Distribute Consortium data to non-members only in accordance with the adopted Consortium data distribution policy." Section 10(a) lists the policies the Policy Committee must keep: distribution to non-members, "Data sales", "Data licensing", "Freedom of Information requests", "Public Internet data distribution". I did not find the policy itself (the "Digital Data Policy") online.
- **Members** (CCGISC home page, read 2026-11-18): Champaign County, City of Champaign, City of Urbana, University of Illinois, Village of Rantoul, Village of Mahomet, Village of Savoy, Village of St Joseph. Principal data clients: Champaign-Urbana Mass Transit District, Champaign-Urbana Public Health District, Urbana-Champaign Sanitary District. Each member is also a public body. The cities and the university are therefore possible FOIA targets, but only for data they hold. The parcel layer comes from the county's assessment office, so the county is the source.
- **A caution from the same agreement.** Section 10(b) says the member who supplied data owns it. The county owns its parcel data. The consortium's added work (linework edits by its software) is the consortium's. This split could matter if the county were willing to release its own assessment-based data in a different form.

---

## Question 2: Copyright and public records

**What I found.** Courts split on whether a government may hold copyright in a map database and use it to limit reuse. I found no Illinois or Seventh Circuit decision on a county parcel database. The Illinois statute (7(1)(i)) does the same work, which may be why nobody has had to ask. I did not read Feist or the Suffolk opinion itself.

| Case | Holding in brief | Bearing here |
|---|---|---|
| *Feist Publications v. Rural Telephone*, 499 U.S. 340 (1991). From general knowledge, not re-read. | Facts cannot be copyrighted. A compilation is protected only for original selection or arrangement, and that protection is "thin". | Ownership, location and acreage are facts. A parcel layer is a compilation, and a lawful copy of the facts is not infringement, but copying the consortium's layer wholesale copies its arrangement. |
| *County of Suffolk v. First American Real Estate Solutions*, 261 F.3d 179 (2d Cir. 2001). Read in a Reporters Committee summary (`rcfp.org/court-rules-copyright-maps-does-not-offend-open-records-law/`). | New York's open records law did not stop a county from holding copyright in its tax maps. The county could refuse to let a company "distribute commercially" copies that the company got by records request. It sent the case back; fair use remained open for people who "educate others or to criticize". | The strongest case for a county. A free app might raise fair use, but a copy-and-ship of the whole layer is the facts of this case. |
| *Seago v. Horry County*, 663 S.E.2d 38 (S.C. 2008). Read in a FindLaw summary (`caselaw.findlaw.com/court/sc-supreme-court/1279054.html`). | "It does not violate FOIA for a public entity to copyright specially-created digital data", and signing the license "was a prerequisite to the production of the data". But the county "may not refuse to honor the initial FOIA request". Fee question sent back. | Another county win. It also shows that a county that licenses may have to give a FOIA copy of the raw records first. |
| *Microdecisions v. Skinner*, 889 So. 2d 871 (Fla. 2d DCA 2004). Read in a Wikipedia summary. | A county property appraiser could not make commercial users sign a license, and could not claim copyright in GIS maps, because Florida's public records law has no express exemption allowing it. | A win for the requester, on Florida statute. Illinois has no matching rule that I found. |
| *County of Santa Clara v. Superior Court*, 170 Cal. App. 4th 1301 (2009). Read in search summaries. | Rejected the county's copyright and licensing claim for its GIS basemap. "No statutory basis either for copyrighting the GIS basemap or for conditioning its release on a licensing agreement." Release at no more than duplication cost, without use restrictions. | A win for the requester, on California statute. |
| *Sierra Club v. Superior Court (County of Orange)*, 57 Cal. 4th 157 (2013). Read in search summaries. | A GIS parcel database is not exempt "software" and must be released at the cost of duplication. | Same, and the opposite of *Hurlbert*. California's statute differs from Illinois's. |
| *Assessment Technologies of WI v. WIREdata*, 350 F.3d 640 (7th Cir. 2003). Read in search summaries. | A vendor's copyright in its assessment software and database layout did not let it block towns from giving out the raw assessment data. A copyright holder cannot use its copyright to lock up public-domain data. | The only Seventh Circuit authority, and it protects access to the raw facts, not a county's own finished layer. Illinois is in the Seventh Circuit. |

**Where the owner's distinction holds.** The facts of who owns what, where, and how large are free for anyone to use, and *Feist* and *WIREdata* both say so. If the facts are obtained from a source that is open to everyone (the assessment file, the recorded plats), the app is free to use them.

**Where it does not.** The consortium's outlines are a digitized, edited compilation. Under *Suffolk* and *Seago* a government may protect that against copying. Under *Hurlbert* an Illinois county may also withhold it by statute. Contract matters too: a licensee is bound by its signed license, and the consortium's website terms say copying is "strictly prohibited". Whether those website terms bind someone who never signed is a contract question I did not research. **LAWYER.** Re-deriving outlines by tracing the consortium's map screen is copying and should be treated as off limits.

**What is uncertain.** Whether Illinois would follow *Suffolk* or *Microdecisions* on county copyright. No Illinois statute I found authorizes a county to hold copyright. Federal law gives a county a copyright only if the map has the originality *Feist* demands, and a map of lines taken from recorded plats may have very little.

---

## Question 3: Other holders of the same public information in Champaign County

I did not log in or query any map service. County web pages (assessor, treasurer, recorder) returned "403 Forbidden" to my fetch tool, so what follows about them comes from search summaries and a local news site. That is marked.

| Holder | What it has | Form and terms | Usable? |
|---|---|---|---|
| **Supervisor of Assessments** (Chief County Assessment Officer). Statute: 35 ILCS 200/9-35 says the supervisor prepares and keeps "maps, ownership lists, and property record cards" (search summary of ilga.gov). | The assessment roll: parcel ID, owner, acreage, assessed value, and tax maps. The Property Tax Code makes property record cards public records (9-20, search summary). It also oversees 19 township and multi-township assessors. | Public lookup by parcel ID only. Owner-name search was removed in 2018 at the request of the treasurer and assessor, according to a local news site. The entire county property database can be requested by FOIA (same news site, read 2026-11-18). | **Yes, for owner, parcel ID, acreage by FOIA (route 1).** Not outlines. |
| **County Treasurer** | Tax billing data by parcel ID. The office's own FOIA list names stubs, bank tapes, distribution and tax sale lists. | A tax lookup by parcel ID (history page covers tax year 2017 and earlier, then points to a newer "Property Tax Inquiry"). I could not open it. | Possible second source for the same owner and parcel ID data. No outlines. |
| **County Recorder** | Recorded deeds and plats. | The county budget says the vault is searchable online. Copy and plat fees I could not confirm. | Public documents, and the raw material for route 5 below. Not a parcel layer. |
| **Township assessors** | Work product feeds the county roll. 19 assessors, seven of them multi-township. | Not published separately that I could find. | No separate data found. |
| **City of Champaign** | Its open data hub (a JavaScript page that returned only a title). The earlier note found no parcel layer on the hub. Search results show the city's own map server lists a "TaxParcels_Assessed" layer and a vacant parcels layer. I did not open the server. | Terms not read. The city is a consortium member, and the agreement says the member who supplied data owns it. The county supplied the parcels. | **Unknown. Lead worth one question to the city GIS office:** is its tax parcel layer its own work, and what are its terms? |
| **City of Urbana** | A Socrata open data site, `data.urbanaillinois.us`, listed on the consortium's page. My fetch tool could not resolve the host. | Not read. | Unknown. Not confirmed to hold parcels. |
| **Villages of Savoy, Rantoul, Mahomet, St Joseph** | Members. I found no GIS or parcel page for Savoy or Rantoul. Mahomet's site points to the consortium's map. | Not read. | No source found. |
| **University of Illinois** | Free WebStore item "Champaign County GIS Consortium Data": a geodatabase (September 2025, about 1 GB) with "property boundaries, annexations, municipal boundaries, street centerlines" and aerial image mosaics (WebStore product page, read 2026-11-18). | Offered under "UIUC Employee type" eligibility: faculty, staff and students. No license text on the page. | **Not for the app.** It is a member's distribution for its own people. Using it would need the university's and the consortium's written leave. |
| **Regional Planning Commission data portal** | Per the earlier note, no parcel layer. | Open data. | No. |
| **Drainage districts** | Individual district maps on file; boundaries overlap. A county planning document says the county map is built from the districts' own maps. | No downloadable layer found. | Boundaries of districts, not parcels. |
| **Forest preserve district** | Not researched in detail. It owns land and would hold only its own parcels. | | No help for private parcels. |
| **Illinois Department of Revenue** | Assessment rules and statistics, not parcel layers. I found no parcel dataset. | | No. |
| **Illinois State Geological Survey, Illinois Geospatial Data Clearinghouse** | PLSS layers (question 4). No Champaign parcel layer found. | | Only PLSS. |
| **Local news site (CU-CitizenAccess)** | A searchable owner database for tax years 2020 through 2025, built from FOIA releases of the property database. | Its own user agreement. A third-party copy. | **Do not use as a source.** It shows route 1 works. It is its own compilation. |

---

## Question 4: Open or federal datasets that are not parcels but help

**Public Land Survey System (PLSS).**
- Federal: the Bureau of Land Management's national PLSS (CadNSDI). Federal data is in the public domain, but the catalog entries I read say "No License Provided". Its own metadata says the data are "not better than the sources from which they were derived", with variable accuracy, and "not a legal document nor a land survey" (via search summaries). Updated quarterly per one catalog. I did not read the BLM page directly (the BLM URL returned 404).
- State: the Illinois State Geological Survey's PLSS boundaries (edition 2.2, `clearinghouse.isgs.illinois.edu/data/reference/illinois-public-land-survey-system-plss-boundaries`, read 2026-11-18). Accuracy statement: "THESE DATA HAVE POSITIONAL INACCURACY OF UP TO 600 FEET IN SOME AREAS OF THE STATE." Use constraint: "Map information is not appropriate for, and is not to be used as, a geodetic, legal, or engineering base." Copyright is held by the University of Illinois Board of Trustees, the ISGS must be credited, and reproduction beyond fair use "requires permission". That is not an open license, so prefer the BLM layer or ask the ISGS for written leave. **LAWYER.**
- How often rural lines follow section and quarter-section lines in east central Illinois: **unknown.** I found no study. Anecdote says most Illinois farm tracts are aliquot parts (halves, quarters, eighties) of sections, but that is my background knowledge and I could not source it. The Illinois Agricultural Conservation Planning Framework field boundary set could be overlaid on the PLSS lines to measure it, but I could not confirm that set's license (its data.gov page returned 404).

**USDA field boundaries.** The Farm Service Agency's Common Land Unit (CLU) data is not public. Section 1619 of the 2008 Farm Bill restricts disclosure of producers' geospatial and other information (7 U.S.C. 8791; search summaries and a 2017 policy paper). CLU outlines also follow farm operations, not ownership, so they would not give owner lines anyway.

**OpenAddresses.** The project's source list for Illinois has a `champaign.json` (county) and `city_of_champaign.json`, and a Macon file (GitHub listing and file, read 2026-11-18). The Champaign file has an address layer and a "parcels" layer. Both point at the consortium's portal proxy at `services.ccgisc.org/portal/sharing/servers/...`, and the file sets a request header that names `https://maps.ccgisc.org/` as the referring page. The parcels layer maps only the parcel ID (`PIN_DASH`). There is no license or attribution in the file, and the project says each source keeps its own license. So there is no openly licensed Champaign parcel data there, and no owner data. It is also evidence that other people have used the proxy.

**Openly licensed nationwide parcel aggregation.** None found. Regrid's non-profit and academic "Data With Purpose" program is "pay what you can", for non-business use, and its terms were not readable. Regrid's free layer is a view-only tile layer. (Search summaries.)

**Illinois counties that publish parcels openly** (for comparison and later expansion; I did not download or test any):
- **Lake County** says it does not claim copyright on its parcel data (search summary). Its catalog entry has one attribute, the parcel number, and disclaims use for boundary determination. Assessment data comes separately.
- **DuPage County** offers parcels free on its open data site and publishes an "Open Geo-Spatial Data License" (search summary). The license terms were not read. DuPage is one of the counties in the *Sage* cases, which is a hint that it chose to open the data.
- **Will County** has a similar custom open license (search summary).
- **Kane County** licenses its GIS data commercially (a board-approved license agreement).
- **Boone County** forbids duplication "for use by others" without permission.
- **Macon County**, already in the app, publishes its parcel service publicly with no posted terms (earlier note).

---

## Question 5: Building the data independently

**Is it realistic?** For a few parcels, yes. For about 80,000 parcels, only with a great deal of work and a lower quality result. This is my judgment, not a cited finding.

What it would take:
1. A control layer: PLSS section and quarter-section lines (route 4 above). Their error is up to 600 feet in places, so they have to be corrected against real survey monuments, which are not in any free dataset I found.
2. Source documents: recorded plats (subdivisions) and deeds with legal descriptions from the Recorder. Plats are public. Legal descriptions in rural parcels are often "the east half of the northwest quarter" style, which can be drawn from PLSS lines, and in subdivisions come from a plat. Metes-and-bounds descriptions need a surveyor's reading.
3. The parcel ID to land link. The assessor's database gives owner, parcel ID, acreage and often a short legal description, so route 1 provides the glue and a way to check each drawn polygon against its stated acreage.
4. Review: every drawn parcel needs a closure and acreage check. Where plats and deeds disagree, a human has to decide.

Cost in time: I could not find a published rate. A reasonable guess is that subdivisions (lots in plats) can be automated, farm tracts that are whole aliquot parts can be automated against the assessor's acreage, and the remaining irregular parcels need hand work. The share of each in Champaign County is not known. Plain statement: this is a research project, not a build step.

**Has an open project done it?** I found none. The search returned only commercial and proprietary tools (Esri's Deed Drafter and COGO Reader, DeedMapper, Bentley's COGO editor) and one hobbyist deed plotter whose license is unstated. Nothing covered a whole county in the open. The nearest open work is OpenAddresses, which collects county-published parcels and does not build them.

**Legal point.** Drawing lines from recorded public documents is the cleanest answer to the consortium's claims, because nothing is copied from the consortium. The risk is accuracy and liability. Illinois reserves boundary determination to licensed land surveyors (the Lake County notice states: "In Illinois, only a registered professional land surveyor is authorized to determine boundary locations"). The app already shows a disclaimer for Macon County, and it would need an even plainer one here. **LAWYER.**

---

## Question 6: Commercial sources (for completeness)

The owner has not agreed to spend money or accept a license. Nothing was bought.

- **Land Records (`landrecords.us`).** Champaign County, one-time download $260, annual license $455, hosted web service $200 a month (product page, read 2026-11-18). 76,976 records with owner names, outline, and fields for assessed value, land use and acreage; the owner address fields were empty for this county. Its Data Products terms (read 2026-11-18): the data "MAY NOT BE DISTRIBUTED, posted, re-sold, reverse engineered, disassembled, exported" without written consent, is "private use only and under no circumstances may this data be made publicly available by any means", and may not be used "to create, sell, license, distribute, or otherwise use derivative works". **Not allowed inside a free app.**
- **Regrid.** Sells all 102 Illinois counties (about 80,000 parcels for Champaign), by county or state. Its published terms page is the website's terms, not a data license, so redistribution rights are not stated anywhere I could read. A data license has to be requested. Owner field coverage was not stated. Unknown.
- **Others** (Reportall USA and similar resellers, plus the large national data brokers) were not read. Resellers of this kind generally license data for internal use. The only way to know is to read each agreement, and nobody here has agreed to do that.

---

## What I could not find or read

- ilga.gov (certificate error). I used the Attorney General's copies of sections 2, 3, 6 and 7. I read section 3.1 only through FindLaw.
- The court's own copy of *Hurlbert*. I used FindLaw's copy and two summaries. The opinions in *Humm*, *Suhr* and *King* were read as summaries only.
- *Seago*, *Suffolk*, *Microdecisions*, *Santa Clara*, *Sierra Club* and *WIREdata* were read in summaries. *Feist* is cited from general knowledge.
- Champaign County government pages (assessor, treasurer, recorder, FOIA contacts): "403 Forbidden". I do not know the FOIA officers' names or addresses, any posted fee schedule, or the Property Tax Inquiry terms.
- The consortium's Digital Data Policy, its license agreement and its prices. All of these sit behind the store or a login.
- Urbana's open data site (host not found), the City of Champaign's hub (script page) and its map server (not opened, to stay clear of map services).
- Whether the PDF tax maps are vector or scanned.
- How often east central Illinois property lines follow section lines.
- Whether *Hurlbert* is binding in Champaign County's appellate district today.
- Whether any Illinois statute lets counties claim copyright in GIS data.

## What in `county-parcel-terms.md` this research contradicts or qualifies

1. **Step 2 note, "the plainest route is to ask the consortium to send the parcel layer (parcel ID, owner name, acreage, outline)."** The consortium's download product carries only the parcel number ("Tax parcel layers only include the parcel number attribute", Products page). Owner name and acreage must come from the Supervisor of Assessments.
2. **The same note says the Step 2 reading of the terms leaves permission to the consortium.** Still true, and now with a legal reason: *Hurlbert* lets an Illinois county refuse and sell, so permission is the county's to give, not a right to be claimed. The note's finding stands.
3. **"City of Champaign open data had no parcel layer."** Accurate for the hub. But search results show the city's own map server lists a tax parcel layer. It is a lead, not a confirmed source.
4. **"No openly readable parcel service exists."** Consistent with what I found. Add that the OpenAddresses project has a Champaign parcels source that goes through the consortium's proxy with a referer header naming the consortium's map site. That use is not a license.
5. **"A web search summary of a consortium data item reported license wording ... unconfirmed."** Still unconfirmed. The *Hurlbert* record independently describes a county license that "prohibits the reproduction and redistribution of the GIS data", which fits.
6. **The note that the consortium's terms forbid saving a tapped parcel.** I did not re-test that. But the consortium is itself a county unit and a public body, and the county's public parcel facts are available from the assessor by FOIA. The prohibition applies to the consortium's website materials, not to the underlying facts.

## Sources (all read 2026-11-18 unless noted)

- 5 ILCS 140 sections 2, 3, 6, 7, Attorney General copies: `https://illinoisattorneygeneral.gov/Page-Attachments/FOIAOMA-Training-Registration/5ILCS140s2.pdf` (and `s3`, `s6`, `s7`). Section 3.1 via `https://codes.findlaw.com/il/chapter-5-general-provisions/il-st-sect-5-140-3-1/`.
- *Hurlbert v. Edmonds*: `https://caselaw.findlaw.com/court/il-court-of-appeals/2062750.html`; `https://municipalminute.ancelglink.com/2023/01/court-finds-tax-map-files-exempt-from.html`; `https://www.illinoislawyernow.com/2023/01/court-finds-tax-map-files-exempt-from-foia/`; citation page `https://leagle.com/decision/inilco20221205126`.
- *Sage v. Humm*, *Suhr*, *King*: `https://municipalminute.ancelglink.com/2014/04/fee-for-electronic-records-excessive.html`; `https://www.nfoic.org/blogs/cost-only-rule-applies-foia-fees-illinois-property-tax-records/`; `https://www.leagle.com/decision/inilco20090603237`.
- Attorney General index of binding opinions: `https://illinoisattorneygeneral.gov/Page-Attachments/FOIAPAC/FOIAIndexOfBindingOpinions.pdf`.
- Consortium: `https://www.ccgisc.org/`, `/DataAndServices.aspx`, `/Products.aspx`, `/FAQs.aspx`, `/TermsOfUse.aspx` (terms last updated 2013-06-17). Intergovernmental agreement text: `https://www.champaigncountyil.gov/CountyBoard/CB/2022/221219_Special_Meeting/221219AgendaFull.pdf` (updated 2022-10-21).
- Local news on county property data: `https://cu-citizenaccess.org/2024/02/champaign-county-doesnt-allow-looking-up-property-by-name-we-made-it-searchable-again/`; `https://cu-citizenaccess.org/2023/12/champaign-county-still-prevents-online-name-searches-of-property-records-differing-from-most-illinois-counties-now-it-plans-to-limit-searching-mobile-home-properties/`; `https://cu-citizenaccess.org/search-champaign-county-property-by-name/`.
- County Treasurer FOIA list of documents (2010): `https://www.champaigncountyil.gov/FOIA/TREAS/availabledocstreas.pdf`.
- Copyright cases: `https://www.rcfp.org/court-rules-copyright-maps-does-not-offend-open-records-law/`; `https://caselaw.findlaw.com/court/sc-supreme-court/1279054.html`; `https://en.wikipedia.org/wiki/Microdecisions,_Inc._v._Skinner`; search summaries for Santa Clara, Sierra Club and WIREdata (`https://law.justia.com/cases/california/supreme-court/2013/s194708.html`, `https://law.resource.org/pub/us/case/reporter/F3/350/350.F3d.640-03-2061.html`).
- PLSS: `https://clearinghouse.isgs.illinois.edu/data/reference/illinois-public-land-survey-system-plss-boundaries`; `https://data.amerigeoss.org/dataset/blm-national-plss-public-land-survey-system-polygons5`.
- OpenAddresses: `https://github.com/openaddresses/openaddresses/blob/master/sources/us/il/champaign.json`.
- University of Illinois WebStore: `https://webstore.illinois.edu/shop/product.aspx?zpid=3194`.
- Commercial: `https://landrecords.us/products/us-il-champaign-county-parcel-layer`; `https://landrecords.us/terms-of-service`; `https://regrid.com/illinois-parcel-data`; `https://regrid.com/terms`.
- Comparison counties: `https://catalog.data.gov/dataset/lakecountyparcels`; search summaries for DuPage, Will, Kane, Boone.
