const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const RSSParser = require('rss-parser');
const xml2js = require('xml2js'); // Для парсинга XML

// Создаем экземпляр бота, используя токен, который хранится в переменной окружения BOT_TOKEN
const bot = new Telegraf(process.env.BOT_TOKEN);

// Определяем обработчик команды /start, который отправляет приветственное сообщение
bot.start((ctx) => ctx.reply(`Привет. \nУ меня планируется множество разных функций\nНапиши /weather для погоды в Санкт-Петербурге и Краснодаре, /news для последних новостей, /currency для курса валют`));

// Определяем обработчик команды /help, который отправляет сообщение с информацией о возможностях бота
bot.help((ctx) => ctx.reply(`Привет, ${ctx.message.from.username}.\nНапиши /weather для погоды в Санкт-Петербурге и Краснодаре, /news для получения последних новостей, /currency для курса валют`));

// Определяем обработчик команды /weather, который отправляет инлайн-кнопки для выбора города
bot.command('weather', (ctx) => {
    ctx.reply('Выберите город:', Markup.inlineKeyboard([
        [Markup.button.callback('Санкт-Петербург', 'weather_spb')],
        [Markup.button.callback('Краснодар', 'weather_krasnodar')]
    ]));
});

// Определяем обработчики для инлайн-кнопок
bot.action('weather_spb', async (ctx) => {
    await sendWeather(ctx, 'Санкт-Петербург');
});

bot.action('weather_krasnodar', async (ctx) => {
    await sendWeather(ctx, 'Краснодар');
});

// Функция для отправки погоды
async function sendWeather(ctx, city) {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ru`);
        const weather = response.data;
        const weatherMessage = `Погода в ${weather.name}:\nТемпература: ${weather.main.temp}°C\nПогодные условия: ${weather.weather[0].description}`;

        ctx.reply(weatherMessage);
    } catch (error) {
        console.error(`Ошибка при получении данных о погоде для ${city}: ${error.message}`);
        ctx.reply(`Извини, я не смог получить данные о погоде для ${city}.`);
    }
}

// Определяем обработчик команды /news для получения последних новостей
bot.command('news', async (ctx) => {
    const rssParser = new RSSParser();
    const feeds = [
        { name: 'Habr', url: 'https://habr.com/ru/rss/feed/f7b94092c7e5bf8d5f164c07c6c581df?fl=ru&rating=25&types%5B%5D=article&types%5B%5D=news' },
        { name: 'PPC World', url: 'https://ppc.world/feed/' },
        { name: 'AdIndex', url: 'https://adindex.ru/news/news.rss' }
    ];

    for (const feed of feeds) {
        try {
            const feedData = await rssParser.parseURL(feed.url);
            const newsItems = feedData.items.slice(0, 5); // Получаем последние 5 новостей из текущего фида

            if (newsItems.length > 0) {
                let newsMessage = `Последние новости с ${feed.name}:\n\n`;
                newsItems.forEach((news, index) => {
                    newsMessage += `${index + 1}. ${news.title}\n${news.link}\n\n`;
                });
                ctx.reply(newsMessage);
            } else {
                ctx.reply(`Извини, я не смог найти последние новости на ${feed.name}.`);
            }
        } catch (feedError) {
            console.error(`Ошибка при получении новостей из фида ${feed.name}: ${feedError.message}`);
            ctx.reply(`Извини, произошла ошибка при получении новостей из ${feed.name}.`);
        }
    }
});

// Определяем обработчик команды /currency для получения курса валют
bot.command('currency', async (ctx) => {
    try {
        const response = await axios.get('https://www.cbr.ru/scripts/XML_daily.asp');
        const xml = response.data;

        // Парсим XML в JSON
        xml2js.parseString(xml, (err, result) => {
            if (err) {
                console.error(`Ошибка при парсинге XML: ${err.message}`);
                ctx.reply('Извини, я не смог получить данные о курсах валют.');
                return;
            }

            const currencies = result.ValCurs.Valute;
            let currencyMessage = 'Текущие курсы валют по отношению к рублю:\n\n';

            // Список кодов валют, которые нам нужны
            const targetCurrencies = ['USD', 'EUR', 'CNY', 'TRY'];

            currencies.forEach(currency => {
                const charCode = currency.CharCode[0];
                if (targetCurrencies.includes(charCode)) {
                    const value = parseFloat(currency.Value[0].replace(',', '.'));
                    const nominal = parseInt(currency.Nominal[0]);
                    currencyMessage += `${charCode}: ${value / nominal} руб.\n`;
                }
            });

            if (currencyMessage === 'Текущие курсы валют по отношению к рублю:\n\n') {
                currencyMessage = 'Извини, я не нашел данные для выбранных валют.';
            }

            ctx.reply(currencyMessage);
        });
    } catch (error) {
        console.error(`Ошибка при получении данных о курсах валют: ${error.message}`);
        ctx.reply('Извини, я не смог получить данные о курсах валют.');
    }
});

// Обрабатываем обычные текстовые сообщения
bot.on('text', (ctx) => {
    ctx.reply(`Привет, ${ctx.message.from.username}\nНапиши /weather для погоды в Санкт-Петербурге и Краснодаре, /news для получения последних новостей, /currency для курса валют`);
});

// Экспортируем функцию-обработчик для Yandex Cloud Function
module.exports.handler = async function (event, context) {
    const message = JSON.parse(event.body);
    await bot.handleUpdate(message);
    return {
        statusCode: 200,
        body: '',
    };
};
