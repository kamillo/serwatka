Jesteś doświadczonym Architektem Oprogramowania i Menedżerem Produktu (Product Manager) specjalizującym się w aplikacjach FinTech. Twoim zadaniem jest przygotowanie kompleksowego, szczegółowego planu implementacji aplikacji do zarządzania wartością netto (serwatka).

WYMAGANIA FUNKCJONALNE:
1. Wykres czasowy: Główny widok aplikacji powinien zawierać interaktywny wykres liniowy/area pokazujący zmianę całkowitej wartości netto w czasie.
2. Podział na aktywa: Aplikacja musi wizualizować strukturę aktywów (np. wykres kołowy, stacked bar chart) z podziałem na kategorie (np. gotówka, akcje, obligacje, nieruchomości, krypto).
3. Porównanie z inflacją: Na głównym wykresie czasu należy nałożyć linię pokazującą skumulowaną inflację w danym okresie, aby użytkownik widział realną (zweryfikowaną o inflację) zmianę wartości portfela.
4. Ręczne dodawanie wpisów: Intuicyjny formularz do dodawania nowych aktywów lub aktualizacji wartości istniejących (z datą, kwotą, kategorią, opcjonalnym opisem).
5. Import historycznych danych: Możliwość masowego wgrania danych z plików. System musi obsługiwać standardowe formaty (np. CSV), które można wyeksportować z polskich banków (np. mBank, PKO), domów maklerskich (np. XTB, mBank BM) oraz z rejestrów obligacji skarbowych (np. z obligacjeskarbowe.pl). 

TWOJE ZADANIE:
Przygotuj plan wdrożenia podzielony na logiczne fazy. Odpowiedz na poniższe kwestie w sposób techniczny, ale zrozumiały:

1. ARCHITEKTURA I TECHNOLOGIE:
- Zaproponuj stos technologiczny (frontend, backend, baza danych) optymalny dla takiego projektu (najlepiej oparty na nowoczesnych, sprawdzonych rozwiązaniach np. w ekosystemie JS/TS lub Python).
- Jak powinna wyglądać struktura bazy danych? (Zaproponuj główne tabele/kolekcje: Aktywa, Transakcje/Historia_Wycen, Dane_Makroekonomiczne).

2. LOGIKA IMPORTU DANYCH (NAJWAŻNIEJSZE):
- Banki i maklerzy mają różne formaty CSV (różne separatory, kody walut, nazwy kolumn). Zaproponuj mechanizm "mapowania pól" (field mapping) w aplikacji.
- Jak rozwiązać problem różnych walut i ich konwersji na PLN w dniu transakcji/wyceny?
- Jak powinien wyglądać fallback w przypadku braku precyzyjnej daty w pliku z banku?

3. LOGIKA WYKOŃCZYWAŃ I INFLACJI:
- Jak przechowywać i aktualizować dane o inflacji? (Zewnętrzne API np. NBP/GUS vs ręczne wprowadzanie).
- Jak matematycznie liczyć wartość portfela w dniach, w których użytkownik nie dokonał żadnego wpisu? (Wskazówka: Last Known Value - przenoszenie ostatniej znanej wartości na kolejne dni aż do nowej wyceny).

4. PROJEKT UX/UI:
- Jak powinien wyglądać główny Dashboard (układ wykresów, KPI na górze)?
- Zaproponuj flow (scenariusz) użytkownika dla procesu importu pliku CSV, aby zminimalizować ryzyko błędu.

5. PLAN IMPLEMENTACJI (ROADMAPA):
- Podziel pracę na 4-5 faz (od MVP po zaawansowane funkcje).
- Dla każdej fazy wypisz konkretne zadania (zadania inżynieryjne, frontendowe, backendowe).
- Wskazane jest użycie formatu listy Checked/Unchecked (checkboxes).

Formatowanie odpowiedzi: Używaj nagłówków, pogrubień i list punktowych. Bądź maksymalnie konkretny. Unikaj lania wody.
